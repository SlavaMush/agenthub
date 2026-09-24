"""Quote engine tests: unit tests with a fake pair_info, one live test."""
from types import SimpleNamespace

import pytest

from bot.intent import TradeIntent
from bot.quote import build_quote, format_quote


def fake_pair(open_fee_p=0.045, min_lev=1, max_lev=50, min_notional=10):
    return SimpleNamespace(
        leverages=SimpleNamespace(min_leverage=min_lev, max_leverage=max_lev),
        open_fee_p=open_fee_p,
        min_lev_pos_usdc=min_notional,
    )


ETH = 3500.0


class TestBuildQuote:
    def test_basic_long(self):
        intent = TradeIntent(action="open", pair="ETH/USD", side="long", collateral=100, leverage=10)
        q = build_quote(intent, fake_pair(), ETH)
        assert q.verdict == "ok"
        assert q.notional == 1000
        assert q.open_fee_usdc == pytest.approx(0.45)
        assert q.entry_price == ETH
        assert q.est_liquidation_price and q.est_liquidation_price < ETH

    def test_leverage_too_high_rejected(self):
        intent = TradeIntent(action="open", pair="ETH/USD", side="long", collateral=100, leverage=100)
        q = build_quote(intent, fake_pair(), ETH)
        assert q.verdict == "rejected"
        assert any("leverage" in r for r in q.reasons)

    def test_below_min_notional_rejected(self):
        intent = TradeIntent(action="open", pair="ETH/USD", side="long", collateral=1, leverage=2)
        q = build_quote(intent, fake_pair(min_notional=10), ETH)
        assert q.verdict == "rejected"

    def test_stop_loss_percent_long(self):
        intent = TradeIntent(
            action="open", pair="ETH/USD", side="long", collateral=100, leverage=5, stop_loss_pct=10
        )
        q = build_quote(intent, fake_pair(), ETH)
        assert q.stop_loss == pytest.approx(3150.0)

    def test_stop_loss_percent_short(self):
        intent = TradeIntent(
            action="open", pair="ETH/USD", side="short", collateral=100, leverage=5, stop_loss_pct=10
        )
        q = build_quote(intent, fake_pair(), ETH)
        assert q.stop_loss == pytest.approx(3850.0)

    def test_wrong_side_tp_rejected(self):
        intent = TradeIntent(
            action="open", pair="ETH/USD", side="long", collateral=100, leverage=5, take_profit_price=3000
        )
        q = build_quote(intent, fake_pair(), ETH)
        assert q.verdict == "rejected"
        assert any("take profit" in r for r in q.reasons)


class TestFormat:
    def test_format_contains_key_lines(self):
        intent = TradeIntent(
            action="open", pair="ETH/USD", side="long", collateral=100, leverage=10, stop_loss_pct=10
        )
        q = build_quote(intent, fake_pair(), ETH)
        text = format_quote(q)
        assert "LONG ETH/USD" in text
        assert "10x" in text
        assert "Notional: 1000" in text
        assert "liquidation" in text.lower()
        assert "Stop loss: 3150" in text


class TestLiveMainnet:
    @pytest.mark.asyncio
    async def test_real_pair_and_quote(self):
        from bot.markets import MarketData

        async with MarketData() as md:
            pair = await md.pair_info("ETH/USD")
        assert pair.index == 0
        intent = TradeIntent(action="open", pair="ETH/USD", side="long", collateral=100, leverage=10)
        q = build_quote(intent, pair, 3500.0)
        assert q.verdict == "ok"
        assert q.open_fee_usdc > 0
