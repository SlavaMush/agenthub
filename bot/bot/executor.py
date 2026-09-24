"""Executor: signs and submits trades for users via the platform delegate key."""
import asyncio
from typing import Any, Callable, Optional

from veranta_sdk import AsyncVeranta
from veranta_sdk.errors import RateLimitedError, RelayTimeoutError

from .intent import TradeIntent


class Executor:
    """Wraps AsyncVeranta with delegate-mode execution and mapped errors.

    Each user has their OWN delegate key registered on-chain with them as trader.
    This executor accepts a `signer_resolver` callable: given a trader address,
    return the decrypted delegate private key used to sign.
    """

    def __init__(
        self,
        private_key: Optional[str],  # deprecated: kept for backwards-compat
        network: str = "testnet",
        builder_code: Optional[str] = None,
        builder_fee_percent: Optional[float] = None,
        client_factory: Callable[..., Any] = AsyncVeranta,
        signer_resolver: Optional[Callable[[str], str]] = None,
    ):
        self._network = network
        self._cfg_extra: dict[str, Any] = {"network": network}
        if builder_code:
            self._cfg_extra["builder_code"] = builder_code
        if builder_fee_percent is not None:
            self._cfg_extra["builder_fee_percent"] = builder_fee_percent
        if signer_resolver is None:
            if not private_key:
                raise ValueError("private_key or signer_resolver required")
            signer_resolver = lambda _trader: private_key  # noqa: E731
        self._resolve_signer = signer_resolver
        self._factory = client_factory

    def _client(self, trader: str):
        pkey = self._resolve_signer(trader)
        return self._factory(trader_address=trader, private_key=pkey, **self._cfg_extra)

    async def _retry_rate_limit(self, fn, attempts=3, base_delay=1.0):
        for i in range(attempts):
            try:
                return await fn()
            except RateLimitedError:
                if i == attempts - 1:
                    raise
                await asyncio.sleep(base_delay * (2**i))

    async def open(self, intent: TradeIntent, *, trader: str):
        """Market-open for a user. Returns the fill receipt."""
        kwargs = dict(
            collateral=intent.collateral,
            leverage=intent.leverage,
        )
        if intent.take_profit_price:
            kwargs["take_profit"] = intent.take_profit_price
        if intent.stop_loss_price:
            kwargs["stop_loss"] = intent.stop_loss_price

        async with self._client(trader) as c:
            return await self._retry_rate_limit(
                lambda: c.trade.market_open(intent.pair, intent.side, **kwargs)
            )

    async def open_with_quote(self, intent: TradeIntent, quote, *, trader: str):
        """Open using the quote's resolved TP/SL prices."""
        intent.take_profit_price = quote.take_profit
        intent.stop_loss_price = quote.stop_loss
        return await self.open(intent, trader=trader)

    async def positions(self, *, trader: str):
        async with self._client(trader) as c:
            return await c.account.positions()

    async def close_all(self, *, trader: str):
        """Close every open position for the user at market."""
        data = await self.positions(trader=trader)
        receipts = []
        async with self._client(trader) as c:
            for pos in data.positions:
                r = await self._retry_rate_limit(
                    lambda pos=pos: c.trade.market_close(
                        pos.pair_index, pos.index, collateral_to_close=float(pos.collateral)
                    )
                )
                receipts.append(r)
        return receipts

    async def verify_delegation(self, *, trader: str) -> bool:
        """True if our delegate key can act for this trader."""
        async with self._client(trader) as c:
            try:
                await c.account.verify_delegation()
                return True
            except Exception:
                return False

    async def delegation_status(self, *, trader: str):
        async with self._client(trader) as c:
            return await c.account.delegation_status()

    async def wallet_state(self, *, trader: str) -> dict:
        """USDC balance + TradingStorage allowance, via the SDK allowance() call."""
        async with self._client(trader) as c:
            allowance = await c.account.allowance()
            return {
                "trader": trader,
                "usdc_balance": float(allowance.get("balanceUsdc", 0) or 0),
                "usdc_allowance": float(allowance.get("allowanceUsdc", 0) or 0),
            }

    async def safe_positions_after_timeout(self, *, trader: str):
        """Call after RelayTimeoutError to learn whether the order filled."""
        return await self.positions(trader=trader)
