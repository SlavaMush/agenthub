"""Parser tests: normalization, opens, closes, tp/sl clauses."""
import pytest

from bot.intent import TradeIntent
from bot.parser import UnknownPairError, UnknownParseError, normalize_pair, parse_intent


class TestNormalizePair:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("eth", "ETH/USD"),
            ("ETH", "ETH/USD"),
            ("ETHUSD", "ETH/USD"),
            ("eth/usd", "ETH/USD"),
            ("$ETH", "ETH/USD"),
            ("eth-usd", "ETH/USD"),
            ("BTC_UPSIDE", "BTC/UPSIDE"),
        ],
    )
    def test_forms(self, raw, expected):
        assert normalize_pair(raw) == expected

    def test_rejects_garbage(self):
        with pytest.raises(UnknownPairError):
            normalize_pair("///")


class TestOpenParsing:
    @pytest.mark.parametrize(
        "text,pair,side,collateral,leverage",
        [
            ("long $100 ETH 5x", "ETH/USD", "long", 100.0, 5.0),
            ("long 100 usdc eth at 5x", "ETH/USD", "long", 100.0, 5.0),
            ("long 100 usdc of eth at 5x", "ETH/USD", "long", 100.0, 5.0),
            ("short $250 BTC 10x", "BTC/USD", "short", 250.0, 10.0),
            ("open 5x long eth with $100", "ETH/USD", "long", 100.0, 5.0),
            ("Long 500 dollars of ETH at 5x", "ETH/USD", "long", 500.0, 5.0),
        ],
    )
    def test_open_forms(self, text, pair, side, collateral, leverage):
        intent = parse_intent(text)
        assert intent.action == "open"
        assert intent.pair == pair
        assert intent.side == side
        assert intent.collateral == collateral
        assert intent.leverage == leverage

    def test_stop_loss_percent(self):
        intent = parse_intent("long $100 ETH 5x with a 10% stop")
        assert intent.stop_loss_pct == 10.0
        assert intent.stop_loss_price is None

    def test_stop_loss_price(self):
        intent = parse_intent("long $100 ETH 5x stop at 3200")
        assert intent.stop_loss_price == 3200.0
        assert intent.stop_loss_pct is None

    def test_take_profit_percent(self):
        intent = parse_intent("short $50 SOL 3x tp 25%")
        assert intent.take_profit_pct == 25.0

    def test_take_profit_price(self):
        intent = parse_intent("long $100 ETH 5x take profit 4200")
        assert intent.take_profit_price == 4200.0

    def test_rejects_garbage(self):
        with pytest.raises(UnknownParseError):
            parse_intent("what is the weather today")


class TestCloseParsing:
    def test_close_pair(self):
        intent = parse_intent("close my ETH")
        assert intent.action == "close"
        assert intent.pair == "ETH/USD"
        assert not intent.close_all

    def test_close_everything(self):
        intent = parse_intent("close everything")
        assert intent.action == "close"
        assert intent.close_all

    def test_close_all_variant(self):
        assert parse_intent("close all").close_all
