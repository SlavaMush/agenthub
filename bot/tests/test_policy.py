"""DB and policy engine tests."""
import json

import pytest

from bot import db as dbmod
from bot.db import Journal, Policy, User
from bot.intent import TradeIntent
from bot.policy import check_daily_notional, check_policy, daily_notional
from bot.quote import Quote


@pytest.fixture(autouse=True)
def fresh_db(tmp_path, monkeypatch):
    dbmod.init_db(f"sqlite:///{tmp_path}/t.db")
    yield


def make_user():
    from bot.db import get_session

    with get_session() as s:
        u = User(wallet_address="0xabc", telegram_id="123")
        s.add(u)
        s.commit()
        s.refresh(u)
        return u.id


def quote(notional=1000.0):
    return Quote(
        intent=None, entry_price=1, notional=notional, open_fee_usdc=0,
        est_liquidation_price=None, liq_distance_pct=None,
        take_profit=None, stop_loss=None, verdict="ok",
    )


class TestModels:
    def test_user_policy_roundtrip(self):
        uid = make_user()
        from bot.db import get_session

        with get_session() as s:
            s.add(Policy(user_id=uid, max_leverage=5))
            s.commit()
            p = s.get(Policy, 1)
            assert p.max_leverage == 5
            assert p.max_collateral_per_trade == 250.0  # default


class TestCheckPolicy:
    def test_close_always_allowed_even_paused(self):
        p = Policy(user_id=1, paused=True)
        v = check_policy(TradeIntent(action="close", pair="ETH/USD"), quote(), p, open_position_count=99)
        assert v.allowed

    def test_paused_blocks_open(self):
        p = Policy(user_id=1, paused=True)
        i = TradeIntent(action="open", pair="ETH/USD", side="long", collateral=100, leverage=2)
        v = check_policy(i, quote(), p, 0)
        assert not v.allowed
        assert any("paused" in r for r in v.reasons)

    def test_leverage_cap(self):
        p = Policy(user_id=1, max_leverage=3)
        i = TradeIntent(action="open", pair="ETH/USD", side="long", collateral=100, leverage=10)
        v = check_policy(i, quote(), p, 0)
        assert not v.allowed and any("leverage" in r for r in v.reasons)

    def test_collateral_cap(self):
        p = Policy(user_id=1, max_collateral_per_trade=50)
        i = TradeIntent(action="open", pair="ETH/USD", side="long", collateral=100, leverage=2)
        v = check_policy(i, quote(), p, 0)
        assert not v.allowed

    def test_open_positions_cap(self):
        p = Policy(user_id=1, max_open_positions=2)
        i = TradeIntent(action="open", pair="ETH/USD", side="long", collateral=10, leverage=1)
        v = check_policy(i, quote(), p, 2)
        assert not v.allowed

    def test_ok_case(self):
        p = Policy(user_id=1)
        i = TradeIntent(action="open", pair="ETH/USD", side="long", collateral=100, leverage=2)
        v = check_policy(i, quote(), p, 0)
        assert v.allowed and not v.reasons


class TestDailyNotional:
    def test_aggregation_and_cap(self):
        uid = make_user()
        from bot.db import get_session

        with get_session() as s:
            s.add(Journal(user_id=uid, kind="execute", payload=json.dumps({"notional": 300})))
            s.add(Journal(user_id=uid, kind="execute", payload=json.dumps({"notional": 100})))
            s.add(Journal(user_id=uid, kind="quote", payload=json.dumps({"notional": 9999})))
            s.commit()
        assert daily_notional(uid) == 400.0
        p = Policy(user_id=uid, max_notional_per_day=500)
        # 400 used + 200 new > 500 → deny
        assert check_daily_notional(p, uid, 200) is not None
        # 400 used + 50 new → ok
        assert check_daily_notional(p, uid, 50) is None
