"""Keyless read-only market data via the Veranta SDK."""
from typing import Any

from veranta_sdk import AsyncVeranta


class MarketData:
    """Async context manager wrapping client.markets (no signing key needed)."""

    def __init__(self, network: str = "mainnet"):
        self._client: Any = AsyncVeranta(network=network)

    async def __aenter__(self) -> "MarketData":
        await self._client.__aenter__()
        return self

    async def __aexit__(self, *exc) -> None:
        await self._client.__aexit__(*exc)

    async def pair_info(self, symbol: str):
        return await self._client.markets.pair(symbol)

    async def price(self, symbol: str) -> float:
        """Live mark price for a pair."""
        p = await self._client.markets.price(symbol)
        return float(p.price if hasattr(p, "price") else p)
