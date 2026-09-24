"""Database models: users, policies, journal, delegate links."""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel, create_engine, Session

DATABASE_URL = "sqlite:///./bot.db"
engine = create_engine(DATABASE_URL, echo=False)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    telegram_id: Optional[str] = Field(default=None, index=True)
    x_handle: Optional[str] = Field(default=None, index=True)
    wallet_address: str = Field(index=True)
    usdc_approved: bool = False
    created_at: datetime = Field(default_factory=utcnow)

    policy: Optional["Policy"] = Relationship(back_populates="user")


class Policy(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", unique=True)
    max_leverage: float = 5.0
    max_collateral_per_trade: float = 250.0
    max_notional_per_day: float = 500.0
    max_open_positions: int = 3
    daily_loss_limit: float = 100.0
    paused: bool = False

    user: Optional[User] = Relationship(back_populates="policy")


class Journal(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    ts: datetime = Field(default_factory=utcnow)
    kind: str  # quote | confirm | execute | error | policy_denial
    payload: str  # JSON


class DelegateLink(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("user_id", "delegate_address"),)

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    delegate_address: str
    encrypted_key_material: str = ""  # AES-encrypted delegate privkey (empty = not yet saved)
    expiry_unix: int = 0
    active: bool = False  # set True once the on-chain registerDelegate lands
    pending_digest: str = ""  # EIP-712 digest we asked the user to sign (pre-submit)


class ConnectSessionRow(SQLModel, table=True):
    """Server-side state for the /connect?sid=... flow. Survives restarts."""
    sid: str = Field(primary_key=True)
    telegram_id: str = Field(index=True)
    delegate_address: str
    delegate_private_key: str  # ephemeral, encrypted by VERANTA_CONNECT_MASTER_KEY at rest
    user_wallet: Optional[str] = None
    intent_payload_json: Optional[str] = None
    created_at: datetime = Field(default_factory=utcnow)


def init_db(url: str | None = None):
    global engine
    if url:
        engine = create_engine(url, echo=False)
    SQLModel.metadata.create_all(engine)
    # Idempotent column adds — SQLite's CREATE TABLE IF NOT EXISTS doesn't update
    # existing tables. Adding 'pending_digest' + widening 'active' default to False.
    import sqlite3
    db_path = url.replace("sqlite:///", "") if url else "bot.db"
    try:
        with sqlite3.connect(db_path) as c:
            cols = [r[1] for r in c.execute("PRAGMA table_info(delegatelink)").fetchall()]
            if "pending_digest" not in cols:
                c.execute("ALTER TABLE delegatelink ADD COLUMN pending_digest TEXT DEFAULT ''")
            c.commit()
    except sqlite3.OperationalError:
        pass  # table doesn't exist yet


def get_session() -> Session:
    return Session(engine)
