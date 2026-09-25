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
HELP = ("Examples: `long $20 ETH 5x sl 5% tp 10%` · `short $50 BTC 3x limit 90000` · `close my ETH` · "
        "`close 50% ETH` · `close everything` · `set sl ETH 2400` · `add $10 margin to ETH` · "
        "`cancel orders` · `pause` / `resume`")
N = r"\$?(\d+(?:\.\d+)?)"
TICK = r"\$?([a-z][a-z0-9]{0,14}(?:/usdc?)?)"


@dataclass
class Intent:
    action: str  # open | close | tpsl | margin | cancel
    pair: str = "*"
    side: str = "long"  # margin: add | remove
    collateral: float = 0  # margin: amount
    leverage: float = 1
    price: Optional[float] = None  # limit entry
    stop: bool = False  # entry beyond the mark in the trade's direction -> stop-limit
    pct: float = 100  # share of each position to close
    tp: Optional[float] = None
    sl: Optional[float] = None
    tp_pct: Optional[float] = None
    sl_pct: Optional[float] = None

    def describe(self) -> str:
        where = "ALL pairs" if self.pair == "*" else self.pair
        return {"close": f"Close {self.pct:g}% of your {where} positions",
                "tpsl": f"Set {'TP ' + format(self.tp, ',g') if self.tp else ''}{'SL ' + format(self.sl, ',g') if self.sl else ''} on {where}",
                "margin": f"{self.side.title()} ${self.collateral:g} margin on your latest {where} position",
                "cancel": f"Cancel your {where} limit orders"}[self.action] + "?"


def pair_of(t: str) -> str:
    t = t.upper().split("/")[0]
    return f"{t[:-3] if t.endswith('USD') and len(t) > 3 else t}/USD"


def parse(text: str) -> Optional[Intent]:
    t = text.lower().replace("half", "50%")
    if m := re.search(rf"\bcancel\s+(?:(?:all|my)\s+)*(?:{TICK}\s+)?(?:limit\s+)?orders?\b", t):
        return Intent("cancel", pair_of(m[1]) if m[1] and m[1] != "limit" else "*")
    if re.search(r"\bclose\s+(everything|all)\b", t):
        return Intent("close")
    if m := re.search(rf"\bclose\s+(\d+(?:\.\d+)?)\s*%\s+(?:of\s+)?(?:my\s+)?{TICK}", t):
        return Intent("close", pair_of(m[2]), pct=min(float(m[1]), 100))
    if m := re.search(rf"\bclose\s+(?:my\s+)?{TICK}\b", t):
        return Intent("close", pair_of(m[1]))
    if m := re.search(rf"\b(?:set|move|update|change)\s+(?:my\s+)?(sl|stop(?:\s*loss)?|tp|take\s*profit)\s+(?:on\s+|for\s+)?(?:my\s+)?{TICK}\s+(?:to\s+|at\s+)?{N}", t):
        it = Intent("tpsl", pair_of(m[2]))
        setattr(it, "tp" if m[1].startswith("t") else "sl", float(m[3]))
        return it
    if m := re.search(rf"\b(add|remove|withdraw)\s+{N}\s*(?:usdc?\s+)?(?:of\s+)?(?:margin|collateral)\s+(?:to|from|on)\s+(?:my\s+)?{TICK}", t):
        return Intent("margin", pair_of(m[3]), "add" if m[1] == "add" else "remove", float(m[2]))
    if m := re.search(rf"\b(long|short)\s+(?:of\s+)?{N}\s*(?:usdc?\s+)?(?:of\s+|on\s+|in\s+)?{TICK}(?:\s+(?:at\s+|@\s*|with\s+)?(\d+(?:\.\d+)?)\s*x\b)?", t):
        it = Intent("open", pair_of(m[3]), m[1], float(m[2]), float(m[4] or 1))
    elif m := re.search(rf"\bopen\s+(\d+(?:\.\d+)?)\s*x\s+(long|short)\s+{TICK}\s+(?:with|for)\s+{N}", t):
        it = Intent("open", pair_of(m[3]), m[2], float(m[4]), float(m[1]))
    else:
        return None
    if m := re.search(rf"(?:\blimit\s*(?:at|@)?|\bentry\s*(?:at)?|@)\s*{N}(?![\d.]*\s*x)", t):
        it.price = float(m[1])
    for kind, pat in (("sl", r"(?:stop(?:\s*loss)?|sl)"), ("tp", r"(?:take\s*profit|tp|target)")):
        m = re.search(rf"\b{pat}\s*(?:at|=|:)?\s*{N}\s*(%|percent)?", t) or re.search(rf"{N}\s*(%|percent)\s*{pat}\b", t)
        if m:
            setattr(it, f"{kind}_pct" if m[2] else kind, float(m[1]))
    return it


_fees = {"checked": 0.0, "live": False}


async def fees() -> dict:
    """Builder-fee client settings, only once our code is registered on-chain (else orders would revert)."""
    if BUILDER and time.time() - _fees["checked"] > 600:
        try:
            async with client() as c:
                _fees["live"] = bool((await c.account.builder_code(BUILDER["builder_code"]))["registered"])
            _fees["checked"] = time.time()
        except Exception as e:
            log.warning("builder code check failed: %s", e)
    return BUILDER if _fees["live"] else {}


def client(u: Optional[User] = None, signing: bool = False, **extra) -> AsyncVeranta:
    if not signing:
        return AsyncVeranta(network=NETWORK, trader_address=u.wallet if u else None)
    return AsyncVeranta(network=NETWORK, trader_address=u.wallet, private_key=decrypt(u.delegate_key), **extra)


async def upnl(c, positions) -> list[float]:
    out = []
    for p in positions:
        mark, entry = float(await c.markets.price(p.pair_index)), float(p.open_price)
        out.append((mark - entry) / entry * float(p.position_size) * (1 if p.buy else -1))
    return out


async def quote(u: User, it: Intent) -> tuple[str, bool]:
    """Human-readable quote and whether it passes market rules, wallet readiness and the user's policy."""
    fee_pct = (await fees()).get("builder_fee_percent", 0) if not it.price else 0  # limit orders carry no builder fee
    async with client(u) as c:
        pair = await c.markets.pair(it.pair)
        mark = float(await c.markets.price(it.pair))
        positions = (await c.account.positions(trader=u.wallet)).positions
        open_pnl = sum(await upnl(c, positions))
        trade_allow = await c.account.allowance()
        fee_allow = await c.account.builder_fee_allowance() if fee_pct else {"allowanceUsdc": 0}
    long, size, price = it.side == "long", it.collateral * it.leverage, it.price or mark
    tp = it.tp or (it.tp_pct and price * (1 + (it.tp_pct if long else -it.tp_pct) / 100))
    sl = it.sl or (it.sl_pct and price * (1 - (it.sl_pct if long else -it.sl_pct) / 100))
    it.tp, it.sl, it.tp_pct, it.sl_pct = tp or None, sl or None, None, None
    it.stop = bool(it.price) and (it.price > mark) == long
    platform_fee = size * fee_pct / 100
    used, pnl = day_totals(u.id)
    lev = pair.leverages
    checks = [
        (lev.min_leverage <= it.leverage <= lev.max_leverage, f"{it.pair} allows {lev.min_leverage:g}-{lev.max_leverage:g}x"),
        (size >= pair.min_lev_pos_usdc, f"size ${size:g} is under the ${pair.min_lev_pos_usdc:g} market minimum (collateral × leverage)"),
        (not tp or (tp > price) == long, "take-profit is on the wrong side of entry"),
        (not sl or (sl < price) == long, "stop-loss is on the wrong side of entry"),
        (float(trade_allow.get("balanceUsdc") or 0) >= it.collateral + platform_fee, "not enough USDC in your wallet"),
        (float(trade_allow.get("allowanceUsdc") or 0) >= it.collateral, f"approve USDC for trading first at {WEB_URL}"),
        (not fee_pct or float(fee_allow.get("allowanceUsdc") or 0) >= platform_fee, f"approve the platform fee allowance at {WEB_URL}"),
        (not u.paused, "trading is paused (send `resume`)"),
        (it.leverage <= u.max_leverage, f"over your {u.max_leverage:g}x leverage cap"),
        (it.collateral <= u.max_collateral, f"over your ${u.max_collateral:g} per-trade collateral cap"),
        (used + size <= u.max_daily_notional, f"over your ${u.max_daily_notional:g}/day size cap (${used:.0f} used)"),
        (len(positions) < u.max_positions, f"already at your {u.max_positions}-position cap"),
        (pnl + open_pnl > -u.max_daily_loss, f"daily loss limit ${u.max_daily_loss:g} reached"),
    ]
    liq = compute.estimate_liquidation_price(open_price=price, collateral=it.collateral, leverage=it.leverage, is_long=long)
    kind = ("STOP" if it.stop else "LIMIT") + f" @ {price:,.2f}" if it.price else "market"
    lines = [f"{it.side.upper()} {it.pair} {it.leverage:g}x {kind}"
             f" — ${it.collateral:g} collateral, ${size:g} size",
             f"Entry ~{price:,.2f} · liq ~{float(liq):,.2f} · fees ~${size * pair.open_fee_p / 100 + platform_fee:.2f}"]
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
    if it.action != "open":
        reply = it.describe()
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
            reply, ok = await quote(u, it)  # re-check: prices, balances and caps may have moved
            if not ok:
                return reply
        async with client(u, signing=True, **await fees()) as c:
            if it.action == "open":
                args, kw = (it.pair, it.side, it.collateral, it.leverage), {"take_profit": it.tp, "stop_loss": it.sl}
                r = await (c.trade.limit_open(*args, it.price, stop=it.stop, **kw) if it.price else c.trade.market_open(*args, **kw))
                journal(u.id, "open", notional=it.collateral * it.leverage, pair=it.pair, side=it.side, tx=r.tx_hash)
                return f"{'Limit order placed' if it.price else 'Filled'}: {it.side} {it.pair} ${it.collateral:g} @ {it.leverage:g}x\ntx {r.tx_hash}"
            idx = None if it.pair == "*" else (await c.markets.pair(it.pair)).index
            data = await c.account.positions()
            if it.action == "cancel":
                orders = [o for o in data.limit_orders if idx is None or o.pair_index == idx]
                for o in orders:
                    await c.trade.cancel_limit_order(o.pair_index, o.index)
                return f"Cancelled {len(orders)} order(s)."
            ps = [p for p in data.positions if idx is None or p.pair_index == idx]
            if not ps:
                return "No matching open positions."
            if it.action == "margin":
                p = ps[-1]
                await c.trade.update_margin(p.pair_index, p.index, "deposit" if it.side == "add" else "withdraw", it.collateral)
                return f"Margin updated on {it.pair}."
            no_fee = {}  # never let an exhausted fee allowance trap a user in a position
            if it.action == "close" and (rate := (await fees()).get("builder_fee_percent")):
                owed = sum(float(p.position_size) for p in ps) * it.pct / 100 * rate / 100
                if float((await c.account.builder_fee_allowance()).get("allowanceUsdc") or 0) < owed:
                    no_fee = {"builder_fee_percent": 0}
            for p, pnl in zip(ps, await upnl(c, ps)):
                if it.action == "tpsl":
                    await c.trade.update_tp_sl(p.pair_index, p.index, take_profit=it.tp, stop_loss=it.sl)
                else:
                    r = await c.trade.market_close(p.pair_index, p.index, float(p.collateral) * it.pct / 100, **no_fee)
                    journal(u.id, "close", pnl=pnl * it.pct / 100, pair=p.pair_index, tx=r.tx_hash)
            return f"{'Updated' if it.action == 'tpsl' else 'Closed'} {len(ps)} position(s)."
    except Exception as e:
        log.exception("execute failed")
        journal(u.id, "error", err=f"{type(e).__name__}: {e}"[:300])
        return f"Failed: {str(e)[:200]} — check positions before retrying."


async def portfolio(u: User) -> dict:
    async with client(u) as c:
        data = await c.account.positions(trader=u.wallet)
        return {
            "positions": [{"pair": p.base_symbol or f"#{p.pair_index}", "side": p.side, "collateral": float(p.collateral),
                           "leverage": float(p.leverage), "entry": float(p.open_price), "liq": float(p.liquidation_price),
                           "tp": float(p.tp), "sl": float(p.sl), "pnl": round(x, 2)}
                          for p, x in zip(data.positions, await upnl(c, data.positions))],
            "orders": [{"pair": (await c.markets.pair(o.pair_index)).from_symbol, "side": o.side, "collateral": float(o.collateral),
                        "leverage": float(o.leverage), "price": float(o.price)} for o in data.limit_orders],
        }
