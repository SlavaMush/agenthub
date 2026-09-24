"""Policy engine: decides whether an intent may execute for a user."""
import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import List

from sqlmodel import select

from .db import Journal, Policy, get_session
from .intent import TradeIntent
from .quote import Quote


@dataclass
class PolicyVerdict:
    allowed: bool
    reasons: List[str] = field(default_factory=list)


def check_policy(
    intent: TradeIntent,
    quote: Quote,
    policy: Policy,
    open_position_count: int,
) -> PolicyVerdict:
    """Daily aggregates are read from the Journal by the caller's session."""
    reasons: List[str] = []

    if intent.action == "close":
        # closes always allowed: risk reduction, even when paused
        return PolicyVerdict(allowed=True)

    if policy.paused:
        reasons.append("trading is paused; /resume to re-enable")

    lev = intent.leverage or 1
    if lev > policy.max_leverage:
        reasons.append(f"leverage {lev:g}x exceeds your cap ({policy.max_leverage:g}x)")

    collat = intent.collateral or 0
    if collat > policy.max_collateral_per_trade:
        reasons.append(
            f"collateral {collat:g} USDC exceeds your per-trade cap ({policy.max_collateral_per_trade:g})"
        )

    notional = quote.notional
    if open_position_count >= policy.max_open_positions:
        reasons.append(f"already at max open positions ({policy.max_open_positions})")

    return PolicyVerdict(allowed=not reasons, reasons=reasons)


def daily_notional(user_id: int) -> float:
    """Sum of filled-open notional journaled in the last 24h."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    total = 0.0
    with get_session() as s:
        rows = s.exec(
            select(Journal).where(Journal.user_id == user_id, Journal.ts >= cutoff, Journal.kind == "execute")
        ).all()
        for r in rows:
            try:
                total += float(json.loads(r.payload).get("notional", 0))
            except Exception:
                pass
    return total


def check_daily_notional(policy: Policy, user_id: int, new_notional: float) -> str | None:
    used = daily_notional(user_id)
    if used + new_notional > policy.max_notional_per_day:
        return (
            f"daily notional cap {policy.max_notional_per_day:g} USDC "
            f"(used {used:.0f}, this trade {new_notional:.0f})"
        )
    return None
