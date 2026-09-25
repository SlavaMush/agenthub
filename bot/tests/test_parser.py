import asyncio
import time

import pytest
from eth_account import Account
from eth_account.messages import encode_defunct

from bot import db
from bot.api import recover
from bot.core import chat, parse


@pytest.mark.parametrize("text,pair,side,collateral,leverage", [
    ("long $100 ETH 5x", "ETH/USD", "long", 100, 5),
    ("short 50 btc 3x", "BTC/USD", "short", 50, 3),
    ("long 100 usdc of eth at 5x", "ETH/USD", "long", 100, 5),
    ("LONG $20 ethusd", "ETH/USD", "long", 20, 1),
    ("open 5x long sol with $40", "SOL/USD", "long", 40, 5),
])
def test_open(text, pair, side, collateral, leverage):
    it = parse(text)
    assert (it.action, it.pair, it.side, it.collateral, it.leverage) == ("open", pair, side, collateral, leverage)


def test_tp_sl():
    assert parse("long $100 ETH 5x with a 10% stop").sl_pct == 10
    assert parse("long $100 ETH 5x stop at 3200").sl == 3200
    assert parse("short $50 SOL 3x tp 25%").tp_pct == 25
    assert parse("long $100 ETH 5x take profit 4200").tp == 4200


def test_close_and_unknown():
    assert (parse("close my ETH").action, parse("close my ETH").pair) == ("close", "ETH/USD")
    assert parse("close everything").pair == parse("close all").pair == "*"
    assert parse("what is the weather today") is None


def test_tokens_and_crypto():
    tok = db.sign_token("s-0xabc", 60)
    assert db.read_token(tok, "s-") == "0xabc"
    assert db.read_token(tok, "tg-") is None
    assert db.read_token(tok[:-1] + ("0" if tok[-1] != "0" else "1"), "s-") is None
    assert db.read_token(db.sign_token("s-x", -1), "s-") is None
    assert db.decrypt(db.encrypt("secret")) == "secret"


def test_login_signature_must_match_wallet():
    acct = Account.create()
    text = f"Sign in to AgentHub\nWallet: {acct.address}\nIssued: {int(time.time())}"
    sig = acct.sign_message(encode_defunct(text=text)).signature.hex()
    assert recover(sig, text=text) == acct.address.lower()
    assert recover(sig, text=text + "x") != acct.address.lower()
    assert recover("0x" + "00" * 200, text=text) == ""  # smart-wallet style blobs are rejected


def test_pause_and_inactive_gate():
    u = db.save(db.User(wallet="0x" + "1" * 40))
    assert "Paused" in asyncio.run(chat(u, "pause"))[0] and db.get_user(id=u.id).paused
    reply, token = asyncio.run(chat(u, "long $100 ETH 5x"))
    assert token is None and "Finish setup" in reply
