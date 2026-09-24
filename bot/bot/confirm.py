"""Pending-quote registry: inline-keyboard callback_data -> a stored quote.

Keep it simple: in-memory dict with TTL + a random opaque id. Telegram's 64-byte
callback_data limit means we can't embed the quote; store server-side instead.
"""
import secrets
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional


@dataclass
class PendingQuote:
    user_id: int
    intent: Any  # TradeIntent
    quote: Any  # Quote
    expires_at: float


_store: Dict[str, PendingQuote] = {}


def put(user_id: int, intent, quote, ttl: int = 300) -> str:
    token = secrets.token_urlsafe(12)
    _store[token] = PendingQuote(user_id, intent, quote, time.time() + ttl)
    _gc()
    return token


def pop(token: str, user_id: int) -> Optional[PendingQuote]:
    pq = _store.pop(token, None)
    if not pq:
        return None
    if pq.user_id != user_id or pq.expires_at < time.time():
        return None
    return pq


def _gc() -> None:
    now = time.time()
    for k in [k for k, v in _store.items() if v.expires_at < now]:
        _store.pop(k, None)
