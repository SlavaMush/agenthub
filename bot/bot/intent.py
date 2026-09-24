"""Trade intent model."""
from dataclasses import dataclass
from typing import Literal, Optional


@dataclass
class TradeIntent:
    action: Literal["open", "close"]
    pair: str  # normalized, e.g. "ETH/USD"
    side: Optional[Literal["long", "short"]] = None
    collateral: Optional[float] = None  # USDC
    leverage: Optional[float] = None
    stop_loss_price: Optional[float] = None
    take_profit_price: Optional[float] = None
    stop_loss_pct: Optional[float] = None  # e.g. 10 = 10% adverse move
    take_profit_pct: Optional[float] = None
    close_all: bool = False
