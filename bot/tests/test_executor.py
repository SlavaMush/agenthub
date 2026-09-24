"""Executor tests with a stubbed Veranta client (no network)."""
from types import SimpleNamespace
from typing import Any

import pytest

from bot.executor import Executor
from bot.intent import TradeIntent


class FakeTrade:
    def __init__(self, client):
        self.client = client
        self.open_calls = []
        self.close_calls = []

    async def market_open(self, pair, side, **kwargs):
        self.open_calls.append((pair, side, kwargs))
        return SimpleNamespace(tx_hash="0xabc", order_id=7, route="batched-market")

    async def market_close(self, pair_index, index, *, collateral_to_close):
        self.close_calls.append((pair_index, index, collateral_to_close))
        return SimpleNamespace(tx_hash="0xdef")


class FakeAccount:
    def __init__(self, client):
        self.client = client

    async def positions(self):
        return SimpleNamespace(positions=self.client._positions)

    async def verify_delegation(self):
        if self.client._fail_delegation:
            raise Exception("DelegationError: not registered")

    async def delegation_status(self):
        return {"isEnabled": not self.client._fail_delegation}


class FakeClient:
    def __init__(self, *args, **kwargs):
        self._positions = [
            SimpleNamespace(pair_index=0, index=0, collateral=100.0, side="long"),
            SimpleNamespace(pair_index=1, index=0, collateral=50.0, side="short"),
        ]
        self._fail_delegation = False
        self.trade = FakeTrade(self)
        self.account = FakeAccount(self)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    # test hooks
    last_instance = None

    def __init_subclass__(cls):
        pass


def factory(*args, **kwargs):
    inst = FakeClient(*args, **kwargs)
    FakeTracking.instances.append(inst)
    return inst


class FakeTracking:
    instances: list = []


@pytest.fixture(autouse=True)
def reset():
    FakeTracking.instances = []
    yield


@pytest.fixture
def executor():
    return Executor(private_key="0xkey", network="testnet", client_factory=factory)


class TestOpen:
    @pytest.mark.asyncio
    async def test_open_passes_tp_sl(self, executor):
        intent = TradeIntent(
            action="open", pair="ETH/USD", side="long",
            collateral=100.0, leverage=5.0,
            take_profit_price=4000.0, stop_loss_price=3200.0,
        )
        receipt = await executor.open(intent, trader="0xuser")
        assert receipt.tx_hash == "0xabc"
        pair, side, kwargs = FakeTracking.instances[0].trade.open_calls[0]
        assert pair == "ETH/USD" and side == "long"
        assert kwargs["collateral"] == 100.0
        assert kwargs["leverage"] == 5.0
        assert kwargs["take_profit"] == 4000.0
        assert kwargs["stop_loss"] == 3200.0

    @pytest.mark.asyncio
    async def test_open_omits_unset_tp_sl(self, executor):
        intent = TradeIntent(action="open", pair="ETH/USD", side="long", collateral=100.0, leverage=5.0)
        await executor.open(intent, trader="0xuser")
        _, _, kwargs = FakeTracking.instances[0].trade.open_calls[0]
        assert "take_profit" not in kwargs
        assert "stop_loss" not in kwargs

    @pytest.mark.asyncio
    async def test_open_with_quote_uses_quote_prices(self, executor):
        intent = TradeIntent(action="open", pair="ETH/USD", side="long", collateral=100.0, leverage=5.0)
        quote = SimpleNamespace(take_profit=4100.0, stop_loss=3150.0)
        await executor.open_with_quote(intent, quote, trader="0xuser")
        _, _, kwargs = FakeTracking.instances[0].trade.open_calls[0]
        assert kwargs["take_profit"] == 4100.0
        assert kwargs["stop_loss"] == 3150.0


class TestCloseAll:
    @pytest.mark.asyncio
    async def test_closes_every_position(self, executor):
        receipts = await executor.close_all(trader="0xuser")
        closes = FakeTracking.instances[-1].trade.close_calls
        assert closes == [(0, 0, 100.0), (1, 0, 50.0)]
        assert len(receipts) == 2


class TestConfig:
    def test_builder_config_passed(self):
        e = Executor(
            private_key="0xkey", network="testnet",
            builder_code="MYCODE", builder_fee_percent=0.1,
            client_factory=factory,
        )
        e._client("0xuser")
        assert FakeTracking.instances, "factory should have been called"
