"""Shared core used by both the Telegram bot and the HTTP agent service.

Both transports want the same behavior:
  parse text → build quote (if not close) → policy check → stow pending.
On confirm: pop pending → execute with the user's wallet and journal the result.

This module owns all of that once. Telegram and aiohttp endpoints stay thin.
"""
import json
import logging
from dataclasses import dataclass
from typing import Optional

from sqlmodel import select

from . import confirm
from .config import CONFIRM_TTL_SECONDS
from .db import Journal, Policy, User, get_session
from .executor import Executor
from .markets import MarketData
from .parser import UnknownParseError, parse_intent
from .policy import check_daily_notional, check_policy
from .quote import build_quote, format_quote

log = logging.getLogger("veranta-bot.core")


@dataclass
class ChatResult:
    """Uniform outcome of parsing/handling a chat message."""
    reply: str
    token: Optional[str] = None
    needs_connect: bool = False
    policy_denied: bool = False
    ttl_seconds: int = CONFIRM_TTL_SECONDS


def _journal(user_id: int, kind: str, payload: dict) -> None:
    try:
        with get_session() as s:
            s.add(Journal(user_id=user_id, kind=kind, payload=json.dumps(payload)))
            s.commit()
    except Exception:
        log.exception("journal write failed")


def _get_user_policy(where_clause, *args, **kwargs):
    """Yield (user, policy) detached from session, or (None, None)."""
    with get_session() as s:
        u = s.exec(select(User).where(where_clause)).first()
        if u is None:
            return None, None
        s.expunge(u)
        p = s.exec(select(Policy).where(Policy.user_id == u.id)).first()
        if p is not None:
            s.expunge(p)
        return u, p


def get_user_by_telegram(tg_id: str):
    return _get_user_policy(User.telegram_id == tg_id)


def get_user_by_wallet(wallet: str):
    if not wallet:
        return None, None
    w = wallet.lower()
    with get_session() as s:
        for u in s.exec(select(User)).all():
            if (u.wallet_address or "").lower() == w:
                s.expunge(u)
                p = s.exec(select(Policy).where(Policy.user_id == u.id)).first()
                if p is not None:
                    s.expunge(p)
                return u, p
    return None, None


async def chat(text: str, user: User, policy: Policy) -> ChatResult:
    """Run one chat message end-to-end. Returns reply + optional confirm token."""
    text = (text or "").strip()
    if not text:
        return ChatResult(reply="Empty message.")

    if policy.paused:
        return ChatResult(reply="Trading is paused for your account.")

    try:
        intent = parse_intent(text)
    except UnknownParseError:
        return ChatResult(
            reply=(
                "Didn't understand. Try `long $100 ETH 5x with a 10% stop`, "
                "`close my ETH`, or `close everything`."
            )
        )

    if intent.action == "close":
        token = confirm.put(user.id, intent, None, ttl=CONFIRM_TTL_SECONDS)
        return ChatResult(reply="About to close your position(s). Confirm?", token=token)

    # Friendly pre-check: if user clearly sized below pair minimum, tell them
    # up-front instead of after the quote call.
    # Rough heuristic: notional = collateral * leverage. ETH pair min is 100 USDC.
    collateral = intent.collateral or 0.0
    leverage = intent.leverage or 1.0
    est_notional = collateral * leverage
    # Fetch real pair data first so we check actual mins, not a hardcoded 100.
    async with MarketData() as md:
        pair = await md.pair_info(intent.pair)
        entry = await md.price(intent.pair)

    min_notional = float(getattr(pair, "min_lev_pos_usdc", 0) or 0)
    if min_notional and est_notional < min_notional:
        suggestion = max(1, int(min_notional / max(1.0, leverage)) + 1)
        return ChatResult(
            reply=(
                f"That size is below the protocol minimum: ${collateral:g} × {leverage:g}x = "
                f"~${est_notional:g} notional. {pair.from_symbol}/{pair.to_symbol} requires "
                f"at least ${min_notional:g} notional (= collateral × leverage).\n\n"
                f"Ways to proceed:\n"
                f"  • `long ${suggestion} {intent.pair} {leverage:g}x`\n"
                f"  • `long ${int(min_notional)} {intent.pair} 1x`\n"
                f"  • Or raise your per-trade cap in settings if blocked by policy."
            ),
            policy_denied=True,
        )

    quote = build_quote(intent, pair, entry)

    verdict = check_policy(intent, quote, policy, open_position_count=0)
    daily_reason = check_daily_notional(policy, user.id, quote.notional)
    if daily_reason:
        verdict.allowed = False
        verdict.reasons.append(daily_reason)

    _journal(user.id, "quote", {"text": text, "verdict": quote.verdict, "policy_ok": verdict.allowed})

    body = format_quote(quote)
    if quote.verdict != "ok" or not verdict.allowed:
        reasons = "; ".join(quote.reasons + verdict.reasons) or "not allowed"
        _journal(user.id, "policy_denial", {"reasons": reasons})
        return ChatResult(
            reply=body + f"\n\nBlocked: {reasons}",
            policy_denied=True,
        )

    token = confirm.put(user.id, intent, quote, ttl=CONFIRM_TTL_SECONDS)
    return ChatResult(reply=body, token=token)


@dataclass
class ConfirmResult:
    reply: str
    tx: Optional[str] = None
    ok: bool = False


async def execute_pending(token: str, user: User, executor: Executor) -> ConfirmResult:
    """Pop the pending quote, run the executor, journal the result."""
    pending = confirm.pop(token, user.id)
    if not pending:
        return ConfirmResult(reply="Quote expired. Ask again.")

    wallet = user.wallet_address
    try:
        if pending.intent.action == "close":
            receipts = await executor.close_all(trader=wallet)
            _journal(user.id, "execute", {"close": True, "n": len(receipts)})
            return ConfirmResult(reply=f"Closed {len(receipts)} position(s).", ok=True)
        receipt = await executor.open_with_quote(pending.intent, pending.quote, trader=wallet)
        tx = getattr(receipt, "tx_hash", None)
        _journal(user.id, "execute", {
            "pair": pending.intent.pair,
            "side": pending.intent.side,
            "collateral": pending.intent.collateral,
            "leverage": pending.intent.leverage,
            "notional": pending.quote.notional,
            "tx": tx,
        })
        reply = (
            f"Filled: {pending.intent.side.upper()} {pending.intent.pair} "
            f"{pending.intent.collateral:g} @ {pending.intent.leverage:g}x"
        )
        return ConfirmResult(reply=reply, tx=tx, ok=True)
    except Exception as e:
        _journal(user.id, "error", {"err": f"{type(e).__name__}: {e}"})
        log.exception("execute failed")
        return ConfirmResult(reply=f"Failed: {type(e).__name__}: {str(e)[:200]}")


def pause_user(user: User) -> None:
    with get_session() as s:
        p = s.exec(select(Policy).where(Policy.user_id == user.id)).first()
        if p:
            p.paused = True
            s.add(p)
            s.commit()


def resume_user(user: User) -> None:
    with get_session() as s:
        p = s.exec(select(Policy).where(Policy.user_id == user.id)).first()
        if p:
            p.paused = False
            s.add(p)
            s.commit()
