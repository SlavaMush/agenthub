"""Quote building: fees, liquidation price, TP/SL resolution, verdicts."""
from dataclasses import dataclass, field
from typing import List, Optional

from veranta_sdk import compute

from .intent import TradeIntent


@dataclass
class Quote:
    intent: TradeIntent
    entry_price: float
    notional: float
    open_fee_usdc: float
    est_liquidation_price: Optional[float]
    liq_distance_pct: Optional[float]
    take_profit: Optional[float]
    stop_loss: Optional[float]
    verdict: str = "ok"  # "ok" | "rejected"
    reasons: List[str] = field(default_factory=list)

    @property
    def collateral(self) -> float:
        return float(self.intent.collateral)


def build_quote(intent: TradeIntent, pair_info, mark_price: float) -> Quote:
    reasons: List[str] = []

    lev = intent.leverage or 1
    collat = intent.collateral or 0
    min_lev = float(pair_info.leverages.min_leverage)
    max_lev = float(pair_info.leverages.max_leverage)
    if lev > max_lev:
        reasons.append(f"leverage {lev}x above pair max {max_lev}x")
    if lev < min_lev:
        reasons.append(f"leverage {lev}x below pair min {min_lev}x")

    notional = collat * lev
    min_notional = float(getattr(pair_info, "min_lev_pos_usdc", 0) or 0)
    if min_notional and notional < min_notional:
        reasons.append(f"notional {notional:.0f} USDC below pair minimum {min_notional:.0f}")

    open_fee = notional * float(pair_info.open_fee_p) / 100.0

    is_long = intent.side == "long"
    liq = None
    liq_dist = None
    try:
        liq = compute.estimate_liquidation_price(
            open_price=mark_price, collateral=collat, leverage=lev, is_long=is_long
        )
        liq = float(liq)
        liq_dist = abs(mark_price - liq) / mark_price * 100.0
    except Exception:
        pass

    tp = intent.take_profit_price
    sl = intent.stop_loss_price
    # percent clauses: simple underlying-price move (actionable, app-style)
    if intent.take_profit_pct and tp is None:
        move = intent.take_profit_pct / 100.0
        tp = mark_price * (1 + move) if is_long else mark_price * (1 - move)
    if intent.stop_loss_pct and sl is None:
        move = intent.stop_loss_pct / 100.0
        sl = mark_price * (1 - move) if is_long else mark_price * (1 + move)

    if tp is not None:
        bad = (is_long and tp <= mark_price) or (not is_long and tp >= mark_price)
        if bad:
            reasons.append(f"take profit {tp} on wrong side of entry {mark_price}")
    if sl is not None:
        bad = (is_long and sl >= mark_price) or (not is_long and sl <= mark_price)
        if bad:
            reasons.append(f"stop loss {sl} on wrong side of entry {mark_price}")

    return Quote(
        intent=intent,
        entry_price=mark_price,
        notional=notional,
        open_fee_usdc=open_fee,
        est_liquidation_price=liq,
        liq_distance_pct=liq_dist,
        take_profit=tp,
        stop_loss=sl,
        verdict="rejected" if reasons else "ok",
        reasons=reasons,
    )


def format_quote(q: Quote) -> str:
    i = q.intent
    lines = [
        f"{i.side.upper()} {i.pair} — {i.leverage:g}x",
        f"Collateral: {i.collateral:g} USDC | Notional: {q.notional:g} USDC",
        f"Entry: {q.entry_price:g}",
        f"Open fee: ~{q.open_fee_usdc:.2f} USDC",
    ]
    if q.est_liquidation_price:
        lines.append(
            f"Est. liquidation: {q.est_liquidation_price:g} ({q.liq_distance_pct:.1f}% away)"
        )
    if q.take_profit:
        lines.append(f"Take profit: {q.take_profit:g}")
    if q.stop_loss:
        lines.append(f"Stop loss: {q.stop_loss:g}")
    if q.verdict != "ok":
        lines.append("REJECTED: " + "; ".join(q.reasons))
    return "\n".join(lines)
