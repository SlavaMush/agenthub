"""Natural-language intent parser: regex-first, optional LLM fallback."""
import re
from typing import Optional

from .intent import TradeIntent


class UnknownPairError(ValueError):
    pass


class UnknownParseError(ValueError):
    pass


_QUOTE_RE = re.compile(r"^[A-Z0-9]{1,15}$")

# bare ticker -> pair suffix; upside handled separately
def normalize_pair(raw: str) -> str:
    """Normalize 'eth', 'ETH', 'ETHUSD', 'eth/usd', '$ETH' -> 'ETH/USD'."""
    s = raw.strip().upper().lstrip("$").replace("-", "/").replace("_", "/")
    if "/" not in s and len(s) > 3 and s.endswith("USD"):
        s = s[:-3]
    s = s.rstrip("/")
    if not s:
        raise UnknownPairError(raw)
    if "/" in s:
        base, quote = s.split("/", 1)
        if not base or not quote:
            raise UnknownPairError(raw)
        return f"{base}/{quote}"
    if not _QUOTE_RE.match(s):
        raise UnknownPairError(raw)
    return f"{s}/USD"


_NUM = r"(\d+(?:\.\d+)?)"
_USD_AMT = rf"\$?{_NUM}\s*(?:usdc|usd|dollars?)?"


def _float(m, idx, default=None):
    v = m.group(idx)
    return float(v) if v is not None else default


def _apply_tp_sl(text: str, intent: TradeIntent) -> None:
    sl_m = re.search(rf"(?:stop(?:\s*loss)?|sl)\s*(?:at|=|:)?\s*\$?{_NUM}\s*(%|percent)?", text, re.I)
    if not sl_m:
        # reversed form: "10% stop" / "10 percent stop loss"
        sl_m = re.search(rf"{_NUM}\s*(%|percent)\s*(?:stop|sl)", text, re.I)
    if sl_m:
        if sl_m.group(2):
            intent.stop_loss_pct = float(sl_m.group(1))
        else:
            intent.stop_loss_price = float(sl_m.group(1))
    tp_m = re.search(
        rf"(?:take\s*profit|tp|target)\s*(?:at|=|:)?\s*\$?{_NUM}\s*(%|percent)?", text, re.I
    )
    if tp_m:
        if tp_m.group(2):
            intent.take_profit_pct = float(tp_m.group(1))
        else:
            intent.take_profit_price = float(tp_m.group(1))


_TICKER = r"([A-Za-z$][A-Za-z0-9$/._-]{0,14}?)"


_OPEN_PATTERNS = [
    # "long $100 ETH 5x" / "long 100 usdc of eth at 5x"
    re.compile(
        rf"\b(long|short)\b[ ,]+(?:of\s+)?{_USD_AMT}\s*(?:usdc\s+)?(?:of\s+|in\s+|on\s+)?{_TICKER}?\s*(?:at|@|with|x)?\s*{_NUM}?\s*x?\b",
        re.I,
    ),
    # "open 5x long eth with $100"
    re.compile(
        rf"\bopen\s+{_NUM}\s*x\s+(long|short)\s+{_TICKER}\s+(?:with|for)\s+{_USD_AMT}",
        re.I,
    ),
]


def parse_intent(text: str) -> TradeIntent:
    """Parse natural language into a TradeIntent. Raises UnknownParseError."""
    t = text.strip()
    low = t.lower()

    # closes
    if re.search(r"\bclose\s+(everything|all)\b", low):
        return TradeIntent(action="close", pair="*", close_all=True)
    cm = re.search(rf"\bclose(?:\s+my)?\s+{_TICKER}\b", low)
    if cm:
        return TradeIntent(action="close", pair=normalize_pair(cm.group(1)))

    # opens
    m = _OPEN_PATTERNS[0].search(t)
    if m and m.group(3):
        side = m.group(1).lower()
        intent = TradeIntent(
            action="open",
            side="long" if side == "long" else "short",
            collateral=float(m.group(2)),
            pair=normalize_pair(m.group(3)),
            leverage=_float(m, 4),
        )
        _apply_tp_sl(t, intent)
        return intent
    m = _OPEN_PATTERNS[1].search(t)
    if m:
        side = m.group(2).lower()
        intent = TradeIntent(
            action="open",
            side="long" if side == "long" else "short",
            leverage=float(m.group(1)),
            pair=normalize_pair(m.group(3)),
            collateral=float(m.group(4)),
        )
        _apply_tp_sl(t, intent)
        return intent

    raise UnknownParseError(text)
