"""Config, persistence, secret encryption and signed tokens."""
import hashlib
import hmac
import json
import os
import time
from typing import Optional

from Crypto.Cipher import AES
from dotenv import load_dotenv
from sqlmodel import Field, Session, SQLModel, create_engine, select

load_dotenv()
NETWORK = os.environ.get("VERANTA_NETWORK", "testnet")
WEB_URL = os.environ.get("WEB_URL", "https://agenthub.gg")
PORT = int(os.environ.get("API_PORT", "8791"))
MASTER = os.environ["VERANTA_CONNECT_MASTER_KEY"].encode()
BUILDER = {"builder_code": os.environ["VERANTA_BUILDER_CODE"],
           "builder_fee_percent": float(os.environ.get("VERANTA_BUILDER_FEE_PERCENT") or 0)} \
    if os.environ.get("VERANTA_BUILDER_CODE") else {}
REFERRAL_CODE = os.environ.get("REFERRAL_CODE", "agenthub")
engine = create_engine(os.environ.get("DATABASE_URL", "sqlite:///./bot.db"))
POLICY = ("max_leverage", "max_collateral", "max_daily_notional", "max_positions", "max_daily_loss")


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    wallet: str = Field(unique=True, index=True)  # lowercase EOA
    telegram_id: Optional[str] = Field(default=None, index=True)
    delegate_key: str = ""  # encrypted key of the ACTIVE on-chain delegate
    delegate_expiry: int = 0
    referred: bool = False  # linked to our referral code
    paused: bool = False
    max_leverage: float = 5
    max_collateral: float = 100
    max_daily_notional: float = 500
    max_positions: int = 3
    max_daily_loss: float = 50

    @property
    def active(self) -> bool:
        return bool(self.delegate_key) and self.delegate_expiry > time.time()


class Journal(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    ts: float = Field(default_factory=time.time, index=True)
    kind: str
    notional: float = 0  # opened size, counts toward the daily cap
    pnl: float = 0       # realized estimate on our closes, counts toward the loss limit
    data: str = "{}"


def get_user(**by) -> Optional[User]:
    with Session(engine) as s:
        return s.exec(select(User).filter_by(**by)).first()


def save(obj):
    with Session(engine, expire_on_commit=False) as s:
        s.add(obj)
        s.commit()
    return obj


def journal(uid: int, kind: str, notional: float = 0, pnl: float = 0, **data) -> None:
    save(Journal(user_id=uid, kind=kind, notional=notional, pnl=pnl, data=json.dumps(data)))


def day_totals(uid: int) -> tuple[float, float]:
    """(notional opened, realized pnl) over the last 24h."""
    with Session(engine) as s:
        rows = s.exec(select(Journal).where(Journal.user_id == uid, Journal.ts > time.time() - 86400)).all()
    return sum(r.notional for r in rows), sum(r.pnl for r in rows)


def _key(purpose: bytes) -> bytes:
    return hmac.new(MASTER, purpose, hashlib.sha256).digest()


def encrypt(secret: str) -> str:
    c = AES.new(_key(b"aes"), AES.MODE_GCM)
    ct, tag = c.encrypt_and_digest(secret.encode())
    return (c.nonce + tag + ct).hex()


def decrypt(blob: str) -> str:
    b = bytes.fromhex(blob)
    return AES.new(_key(b"aes"), AES.MODE_GCM, nonce=b[:16]).decrypt_and_verify(b[32:], b[16:32]).decode()


def sign_token(subject: str, ttl: int) -> str:
    body = f"{subject}.{int(time.time()) + ttl}"
    return f"{body}.{hmac.new(_key(b'token'), body.encode(), hashlib.sha256).hexdigest()[:32]}"


def read_token(token: str, prefix: str) -> Optional[str]:
    """Return the subject after `prefix` if the token is authentic and unexpired."""
    parts = (token or "").rsplit(".", 2)
    if len(parts) != 3 or not parts[1].isdigit() or int(parts[1]) < time.time():
        return None
    good = hmac.new(_key(b"token"), f"{parts[0]}.{parts[1]}".encode(), hashlib.sha256).hexdigest()[:32]
    ok = hmac.compare_digest(parts[2], good) and parts[0].startswith(prefix)
    return parts[0][len(prefix):] if ok else None


SQLModel.metadata.create_all(engine)
