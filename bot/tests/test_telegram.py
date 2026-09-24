"""Telegram handler logic tests: no network, no Telegram servers."""
import asyncio
from types import SimpleNamespace

import pytest

from bot import db as dbmod
from bot import telegram_app as tg
from bot.connect import telegram_user_upsert


@pytest.fixture(autouse=True)
def fresh_db(tmp_path):
    dbmod.init_db(f"sqlite:///{tmp_path}/t.db")
    yield


@pytest.fixture
def executor_stub(monkeypatch):
    class Ex:
        async def positions(self, *, trader):
            return SimpleNamespace(positions=[])

        async def close_all(self, *, trader):
            return [SimpleNamespace(tx_hash="0x1")]

        async def open_with_quote(self, intent, quote, *, trader):
            return SimpleNamespace(tx_hash="0xopen")

    return Ex()


def fake_update(text=None, tg_id=42):
    msgs = []
    upd = SimpleNamespace(
        effective_user=SimpleNamespace(id=tg_id),
        message=SimpleNamespace(text=text, reply_text=lambda *a, **k: msgs.append((a, k)) or asyncio.sleep(0)),
        callback_query=None,
    )
    upd._msgs = msgs
    return upd


@pytest.mark.asyncio
async def test_start_new_user_shows_connect_button():
    upd = fake_update("/start")
    await tg.cmd_start(upd, None)
    assert upd._msgs, "no reply"
    args, kwargs = upd._msgs[0]
    text = args[0]
    assert "delegate.veranta.xyz" not in text
    assert "Connect your wallet" in text
    assert kwargs.get("reply_markup") is not None


@pytest.mark.asyncio
async def test_start_with_existing_user_shows_status():
    telegram_user_upsert("42", "0xab" + "cd" * 20)
    upd = fake_update("/start")
    await tg.cmd_start(upd, None)
    assert upd._msgs, "no reply"
    args, kwargs = upd._msgs[0]
    assert "Welcome back" in args[0] or "Connected wallet" in args[0] or "Wallet:" in args[0]


@pytest.mark.asyncio
async def test_wallet_paste_redirects_to_connect():
    upd = fake_update("0x" + "ab" * 20, tg_id=7)
    await tg.on_message(upd, None)
    assert upd._msgs, "no reply"
    args, _ = upd._msgs[0]
    assert "/connect" in args[0] or "don't link" in args[0] or "link wallets by paste" in args[0]
    from bot.db import User, get_session
    from sqlmodel import select

    with get_session() as s:
        u = s.exec(select(User).where(User.telegram_id == "7")).first()
        assert u is None


@pytest.mark.asyncio
async def test_unknown_text_replies_help():
    # Seed the user first (simulates them connecting)
    telegram_user_upsert("7", "0xab" + "cd" * 20)
    upd = fake_update("gm what's up", tg_id=7)
    await tg.on_message(upd, None)
    assert any("understand" in str(a[0]).lower() for a, _ in upd._msgs)


@pytest.mark.asyncio
async def test_pause_flips_policy():
    tg_id = 99
    telegram_user_upsert(str(tg_id), "0xcd" + "ef" * 20)
    upd = fake_update(None, tg_id=tg_id)
    await tg.cmd_pause(upd, None)
    from bot.db import User, Policy, get_session
    from sqlmodel import select

    with get_session() as s:
        u = s.exec(select(User).where(User.telegram_id == str(tg_id))).first()
        p = s.exec(select(Policy).where(Policy.user_id == u.id)).first()
        assert p.paused is True
