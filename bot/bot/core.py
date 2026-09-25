"""Chat -> intent -> quote + policy -> confirm -> execute. Shared by the web API and Telegram."""
import logging
import re
import secrets
import time
from dataclasses import dataclass
from typing import Optional

from veranta_sdk import AsyncVeranta, compute

from .db import BUILDER, NETWORK, WEB_URL, User, day_totals, decrypt, journal, save

log = logging.getLogger("agenthub.core")
HELP = ("Try: `long $20 ETH 5x`, `short $50 BTC 3x sl 5% tp 10%`, `close my ETH`, "
        "`close everything`, `pause`, `resume`.")
N = r"\$?(\d+(?:\.\d+)?)"
TICK = r"\$?([a-z][a-z0-9]{0,14}(?:/usdc?)?)"


@dataclass
class Intent:
    action: str  # open | close
    pair: str = "*"
    side: str = "long"
    collateral: float = 0
    leverage: float = 1
    tp: Optional[float] = None
    sl: Optional[float] = None
    tp_pct: Optional[float] = None
    sl_pct: Optional[float] = None


def pair_of(t: str) -> str:
    t = t.upper().split("/")[0]
    return f"{t[:-3] if t.endswith('USD') and len(t) > 3 else t}/USD"


def parse(text: str) -> Optional[Intent]:
    t = text.lower()
    if re.search(r"\bclose\s+(everything|all)\b", t):
        return Intent("close")
    if m := re.search(rf"\bclose\s+(?:my\s+)?{TICK}\b", t):
        return Intent("close", pair_of(m[1]))
    if m := re.search(rf"\b(long|short)\s+(?:of\s+)?{N}\s*(?:usdc?\s+)?(?:of\s+|on\s+|in\s+)?{TICK}(?:\s+(?:at\s+|@\s*|with\s+)?(\d+(?:\.\d+)?)\s*x\b)?", t):
        it = Intent("open", pair_of(m[3]), m[1], float(m[2]), float(m[4] or 1))
    elif m := re.search(rf"\bopen\s+(\d+(?:\.\d+)?)\s*x\s+(long|short)\s+{TICK}\s+(?:with|for)\s+{N}", t):
        it = Intent("open", pair_of(m[3]), m[2], float(m[4]), float(m[1]))
    else:
        return None
    for kind, pat in (("sl", r"(?:stop(?:\s*loss)?|sl)"), ("tp", r"(?:take\s*profit|tp|target)")):
        m = re.search(rf"\b{pat}\s*(?:at|=|:)?\s*{N}\s*(%|percent)?", t) or re.search(rf"{N}\s*(%|percent)\s*{pat}\b", t)
        if m:
            setattr(it, f"{kind}_pct" if m[2] else kind, float(m[1]))
    return it


def client(u: Optional[User] = None, signing: bool = False) -> AsyncVeranta:
    if not signing:
        return AsyncVeranta(network=NETWORK, trader_address=u.wallet if u else None)
    return AsyncVeranta(network=NETWORK, trader_address=u.wallet, private_key=decrypt(u.delegate_key), **BUILDER)


async def upnl(c, positions) -> list[float]:
    out = []
    for p in positions:
        mark, entry = float(await c.markets.price(p.pair_index)), float(p.open_price)
        out.append((mark - entry) / entry * float(p.position_size) * (1 if p.buy else -1))
    return out


async def quote(u: User, it: Intent) -> tuple[str, bool]:
    """Human-readable quote and whether it passes the market rules and the user's policy."""
    async with client(u) as c:
        pair = await c.markets.pair(it.pair)
        price = float(await c.markets.price(it.pair))
        positions = (await c.account.positions(trader=u.wallet)).positions
        open_pnl = sum(await upnl(c, positions))
    long, size = it.side == "long", it.collateral * it.leverage
    tp = it.tp or (it.tp_pct and price * (1 + (it.tp_pct if long else -it.tp_pct) / 100))
    sl = it.sl or (it.sl_pct and price * (1 - (it.sl_pct if long else -it.sl_pct) / 100))
    it.tp, it.sl, it.tp_pct, it.sl_pct = tp or None, sl or None, None, None
    used, pnl = day_totals(u.id)
    lev = pair.leverages
    checks = [
        (lev.min_leverage <= it.leverage <= lev.max_leverage, f"{it.pair} allows {lev.min_leverage:g}-{lev.max_leverage:g}x"),
        (size >= pair.min_lev_pos_usdc, f"size ${size:g} is under the ${pair.min_lev_pos_usdc:g} market minimum (collateral × leverage)"),
        (not tp or (tp > price) == long, "take-profit is on the wrong side of entry"),
        (not sl or (sl < price) == long, "stop-loss is on the wrong side of entry"),
        (not u.paused, "trading is paused (send `resume`)"),
        (it.leverage <= u.max_leverage, f"over your {u.max_leverage:g}x leverage cap"),
        (it.collateral <= u.max_collateral, f"over your ${u.max_collateral:g} per-trade collateral cap"),
        (used + size <= u.max_daily_notional, f"over your ${u.max_daily_notional:g}/day size cap (${used:.0f} used)"),
        (len(positions) < u.max_positions, f"already at your {u.max_positions}-position cap"),
        (pnl + open_pnl > -u.max_daily_loss, f"daily loss limit ${u.max_daily_loss:g} reached"),
    ]
    liq = compute.estimate_liquidation_price(open_price=price, collateral=it.collateral, leverage=it.leverage, is_long=long)
    lines = [f"{it.side.upper()} {it.pair} {it.leverage:g}x — ${it.collateral:g} collateral, ${size:g} size",
             f"Entry ~{price:,.2f} · fee ~${size * pair.open_fee_p / 100:.2f} · liq ~{float(liq):,.2f}"]
    lines += [f"TP {tp:,.2f}"] if tp else []
    lines += [f"SL {sl:,.2f}"] if sl else []
    problems = [msg for ok, msg in checks if not ok]
    return "\n".join(lines + ([f"Blocked: {'; '.join(problems)}"] if problems else [])), not problems


_pending: dict[str, tuple[float, int, Intent]] = {}


async def chat(u: User, text: str) -> tuple[str, Optional[str]]:
    """Reply text plus a confirm token when there is something to execute."""
    cmd = text.strip().lower()
    if cmd in ("pause", "resume"):
        u.paused = cmd == "pause"
        save(u)
        return ("Paused. Closes still work." if u.paused else "Trading resumed."), None
    if not u.active:
        return f"Finish setup first: sign the delegation at {WEB_URL}", None
    it = parse(text)
    if not it:
        return f"Didn't catch that. {HELP}", None
    if it.action == "close":
        reply = f"Close {'ALL positions' if it.pair == '*' else 'your ' + it.pair + ' positions'}?"
    else:
        try:
            reply, ok = await quote(u, it)
        except Exception as e:
            return f"Couldn't price {it.pair}: {str(e)[:150]}", None
        if not ok:
            return reply, None
    now = time.time()
    for k in [k for k, v in _pending.items() if v[0] < now]:
        del _pending[k]
    token = secrets.token_urlsafe(9)
    _pending[token] = (now + 300, u.id, it)
    return reply, token


async def confirm(u: User, token: str) -> str:
    exp, owner, it = _pending.pop(token, (0, None, None))
    if owner != u.id or exp < time.time():
        return "Quote expired — send it again."
    try:
        if it.action == "open":
            reply, ok = await quote(u, it)  # re-check: prices and caps may have moved
            if not ok:
                return reply
        async with client(u, signing=True) as c:
            if it.action == "open":
                r = await c.trade.market_open(it.pair, it.side, it.collateral, it.leverage, take_profit=it.tp, stop_loss=it.sl)
                journal(u.id, "open", notional=it.collateral * it.leverage, pair=it.pair, side=it.side, tx=r.tx_hash)
                return f"Filled {it.side} {it.pair} ${it.collateral:g} @ {it.leverage:g}x\ntx {r.tx_hash}"
            idx = None if it.pair == "*" else (await c.markets.pair(it.pair)).index
            ps = [p for p in (await c.account.positions()).positions if idx is None or p.pair_index == idx]
            for p, pnl in zip(ps, await upnl(c, ps)):
                r = await c.trade.market_close(p.pair_index, p.index, float(p.collateral))
                journal(u.id, "close", pnl=pnl, pair=p.pair_index, tx=r.tx_hash)
            return f"Closed {len(ps)} position(s)."
    except Exception as e:
        log.exception("execute failed")
        journal(u.id, "error", err=f"{type(e).__name__}: {e}"[:300])
        return f"Failed: {str(e)[:200]} — check positions before retrying."


async def positions(u: User) -> list[dict]:
    async with client(u) as c:
        ps = (await c.account.positions(trader=u.wallet)).positions
        return [{"pair": p.base_symbol or f"#{p.pair_index}", "side": p.side, "collateral": float(p.collateral),
                 "leverage": float(p.leverage), "entry": float(p.open_price), "liq": float(p.liquidation_price),
                 "pnl": round(x, 2)} for p, x in zip(ps, await upnl(c, ps))]
