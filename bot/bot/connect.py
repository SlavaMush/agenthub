"""Connect service: bridges the Telegram bot and a WalletConnect web flow.

The flow:
1. Telegram bot issues a one-time session id (sid) via /connect command.
2. User opens agenthub.gg/connect?sid=... which loads this service.
3. GET  /api/connect/{sid}/intent  -> returns EIP-712 typed data (no signing).
4. Wallet signs via WalletConnect (eth_signTypedData_v4).
5. POST /api/connect/{sid}/submit {address, signature}
   -> we submit setDelegateWithSig via the platform relayer key.

The delegate key is per-user: generated fresh at sid creation, encrypted with
a master key from VERANTA_CONNECT_MASTER_KEY, stored in the DB bound to the user.
"""
import hashlib
import hmac
import json
import os
import secrets
import time
from dataclasses import dataclass, field
from typing import Optional

from aiohttp import web
from Crypto.Cipher import AES  # pycryptodome ships with eth-account

from veranta_sdk import AsyncVeranta
from veranta_sdk.signing.base import BaseSigner
from veranta_sdk.types import IntentPayload

from .config import NETWORK, PLATFORM_DELEGATE_KEY

CONNECT_TTL_SECONDS = 900  # 15 min


def _derive_aes_key(master: str) -> bytes:
    # any passphrase -> 32-byte AES key
    return hashlib.sha256(master.encode()).digest()


def encrypt_secret(secret: str, master: str) -> str:
    key = _derive_aes_key(master)
    blob = secret.encode()
    pad = 16 - (len(blob) % 16)
    blob += bytes([pad]) * pad
    iv = secrets.token_bytes(16)
    cipher = AES.new(key, AES.MODE_CBC, iv)
    ct = cipher.encrypt(blob)
    return iv.hex() + ":" + ct.hex()


def decrypt_secret(encoded: str, master: str) -> str:
    iv_hex, ct_hex = encoded.split(":")
    key = _derive_aes_key(master)
    cipher = AES.new(key, AES.MODE_CBC, bytes.fromhex(iv_hex))
    pt = cipher.decrypt(bytes.fromhex(ct_hex))
    pad = pt[-1]
    return pt[:-pad].decode()


@dataclass
class ConnectSession:
    sid: str
    telegram_id: str
    delegate_private_key: str
    delegate_address: str
    created_at: float = field(default_factory=time.time)
    user_wallet: Optional[str] = None
    intent_payload_json: Optional[str] = None


def _row_to_session(r) -> ConnectSession:
    # SQLAlchemy may return naive timestamps from SQLite — treat them as UTC.
    from datetime import timezone
    dt = r.created_at
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return ConnectSession(
        sid=r.sid,
        telegram_id=r.telegram_id,
        delegate_private_key=r.delegate_private_key,
        delegate_address=r.delegate_address,
        created_at=dt.timestamp(),
        user_wallet=r.user_wallet,
        intent_payload_json=r.intent_payload_json,
    )


def _save_session(s: ConnectSession) -> None:
    from datetime import datetime, timezone
    from .db import ConnectSessionRow, get_session
    with get_session() as sess:
        row = sess.get(ConnectSessionRow, s.sid)
        if row is None:
            row = ConnectSessionRow(sid=s.sid, telegram_id=s.telegram_id,
                                    delegate_address=s.delegate_address,
                                    delegate_private_key=s.delegate_private_key)
        row.user_wallet = s.user_wallet
        row.intent_payload_json = s.intent_payload_json
        sess.add(row)
        sess.commit()


def get_or_create_session(telegram_id: str) -> ConnectSession:
    """Reuse the most recent unexpired, unsubmitted session for this user."""
    from sqlmodel import select
    from .db import ConnectSessionRow, get_session
    with get_session() as sess:
        rows = sess.exec(
            select(ConnectSessionRow)
            .where(ConnectSessionRow.telegram_id == telegram_id)
            .order_by(ConnectSessionRow.created_at.desc())
        ).all()
        for r in rows:
            if time.time() - r.created_at.timestamp() < CONNECT_TTL_SECONDS:
                return _row_to_session(r)
    return new_session(telegram_id)


def new_session(telegram_id: str) -> ConnectSession:
    from eth_account import Account

    acct = Account.create()
    sid = secrets.token_urlsafe(16)
    s = ConnectSession(
        sid=sid,
        telegram_id=telegram_id,
        delegate_private_key=acct.key.hex(),
        delegate_address=acct.address,
    )
    _save_session(s)
    return s


def get_session(sid: str) -> Optional[ConnectSession]:
    from .db import ConnectSessionRow, get_session as tgdb
    with tgdb() as sess:
        r = sess.get(ConnectSessionRow, sid)
        if not r:
            return None
        if time.time() - r.created_at.timestamp() > CONNECT_TTL_SECONDS:
            return None
        return _row_to_session(r)


class RelayerSubmitter:
    """Submit signed intents through the platform relayer key."""

    def __init__(self, platform_private_key: str, network: str):
        self._pk = platform_private_key
        self._network = network

    async def set_delegate_with_sig(
        self, *, trader: str, delegate: str, expiry_seconds: int, signature: str
    ) -> str:
        """Build the DelegateReq intent, submit with the given signature."""
        import time as _t

        # Build the typed-data payload (not signed by us; we already have user's sig).
        async with AsyncVeranta(private_key=self._pk, network=self._network) as c:
            acc = c.account
            # Intent builder — no signing, just the payload.
            payload: IntentPayload = await acc._txb.intent(
                "/v2/intents/delegate-set",
                trader=trader,
                delegate=delegate,
                expirySeconds=expiry_seconds,
            )
            # Sanity-check that the expected digest matches what the relayer expects.
            # Then construct the calldata: setDelegateWithSig(sig, encodedIntent).
            from eth_abi import encode as abi_encode
            from eth_utils import keccak, to_bytes

            selector = keccak(text="setDelegateWithSig(bytes,bytes)")[:4]
            calldata_no_sel = abi_encode(
                ["bytes", "bytes"],
                [to_bytes(hexstr=signature), to_bytes(hexstr=payload.encoded_intent)],
            )
            full_calldata = "0x" + (selector + calldata_no_sel).hex()

            # Build relayer tx using the platform key (as the calling EOA).
            # The Veranta SDK routes by sending the calldata through the relayer.
            # We mimic register_delegate's relayer path but with the user's sig.
            meta = await acc._get_meta()
            router = meta["addresses"]["tradingRouter"]

            # Build and execute via the engine (which will take the relayer route).
            # The engine.submit_intent_batch expects market intents; for delegate
            # reg we instead call the relayer endpoint directly.
            from veranta_sdk.execution.relayer import RelayerClient  # type: ignore

            relayer: RelayerClient = c.engine.relayer  # type: ignore[attr-defined]
            # Send a generic "type4 wrapped" tx? Easiest: use engine._route by
            # manually invoking the passthrough route through account internals.
            # For now, call relayer.create with calldata = full setDelegateWithSig
            # targeting the router.
            from veranta_sdk.types import CallData

            from_addr = acc._engine.signer.address if acc._engine.signer else acc.trader
            chain_id = await acc._engine.chain_id()
            call = CallData.model_validate(
                {
                    "to": router,
                    "from": from_addr,
                    "data": full_calldata,
                    "value": "0x0",
                    "chainId": chain_id,
                    "description": f"setDelegateWithSig({delegate}) for {trader}",
                }
            )
            receipt = await acc._route(call, wait=True)
            return getattr(receipt, "tx_hash", str(receipt))


async def handle_intent(request: web.Request) -> web.Response:
    sid = request.match_info["sid"]
    s = get_session(sid)
    if not s:
        return web.json_response({"error": "expired"}, status=404)
    # If we already built the payload, reuse it; otherwise build a speculative one.
    if s.intent_payload_json is None:
        # We need a trader address. The page will supply address after wallet
        # connect; to keep typed-data deterministic, build it lazily at submit
        # time instead. The page needs *something* to sign though: we send a
        # placeholder with trader=delegate as a demo, and replace at submit.
        # Simpler: require the page to submit address *first* via POST.
        return web.json_response({"error": "call /submit with address first"}, status=400)
    return web.json_response(json.loads(s.intent_payload_json))


async def handle_prepare(request: web.Request) -> web.Response:
    """POST with {address} — build the EIP-712 payload for THAT trader."""
    try:
        sid = request.match_info["sid"]
        s = get_session(sid)
        if not s:
            return web.json_response({"error": "expired"}, status=404)
        body = await request.json()
        wallet = body.get("address", "")
        if not wallet.startswith("0x") or len(wallet) != 42:
            return web.json_response({"error": "bad address"}, status=400)
        s.user_wallet = wallet
        _save_session(s)

        import os
        master = os.environ.get("VERANTA_CONNECT_MASTER_KEY", "")
        if not master:
            return web.json_response({"error": "server misconfigured"}, status=500)

        expiry_ts = int(time.time()) + 30 * 86400  # 30 days from now (absolute unix)
        async with AsyncVeranta(
            private_key=PLATFORM_DELEGATE_KEY, network=NETWORK
        ) as c:
            payload: IntentPayload = await c.account._txb.intent(
                "/v2/intents/delegate-set",
                trader=wallet,
                delegate=s.delegate_address,
                expirySeconds=expiry_ts,
            )
            payload_dict = {
                "intent": payload.intent,
                "signerRule": payload.signer_rule,
                "domain": payload.domain,
                "primaryType": payload.primary_type,
                "types": payload.types,
                "message": payload.message,
                "digest": payload.digest,
                "encodedIntent": payload.encoded_intent,
            }
            s.intent_payload_json = json.dumps(payload_dict)
            _save_session(s)
            return web.json_response({"typedData": {
                "domain": payload.domain,
                "types": payload.types,
                "primaryType": payload.primary_type,
                "message": payload.message,
            }, "delegate": s.delegate_address})
    except Exception as e:
        import traceback, logging
        logging.getLogger("veranta-bot.connect").exception("prepare failed")
        return web.json_response(
            {"error": f"{type(e).__name__}: {str(e)[:300]}"}, status=500
        )


async def handle_submit(request: web.Request) -> web.Response:
    try:
        sid = request.match_info["sid"]
        s = get_session(sid)
        if not s:
            return web.json_response({"error": "expired"}, status=404)
        body = await request.json()
        address = body.get("address", "")
        sig = body.get("signature", "")
        if not address or not sig.startswith("0x"):
            return web.json_response({"error": "bad request"}, status=400)
        if s.user_wallet is None or s.user_wallet.lower() != address.lower():
            return web.json_response({"error": "address mismatch"}, status=400)
        if not s.intent_payload_json:
            return web.json_response({"error": "no prepared intent"}, status=400)

        sub = RelayerSubmitter(PLATFORM_DELEGATE_KEY, NETWORK)
        payload = json.loads(s.intent_payload_json)
        expiry_seconds = int(payload["message"].get("expiry", 0))
        if expiry_seconds <= 0:
            return web.json_response({"error": "no expiry in payload"}, status=500)

        try:
            tx = await sub.set_delegate_with_sig(
                trader=address,
                delegate=s.delegate_address,
                expiry_seconds=expiry_seconds,
                signature=sig,
            )
        except Exception as e:
            return web.json_response({"error": f"{type(e).__name__}: {e}"}, status=500)

        import os
        master = os.environ["VERANTA_CONNECT_MASTER_KEY"]
        encrypted = encrypt_secret(s.delegate_private_key, master)
        from .db import DelegateLink, get_session as tgdb
        from sqlmodel import select

        user_id = telegram_user_upsert(s.telegram_id, address)
        with tgdb() as sess:
            existing = sess.exec(
                select(DelegateLink).where(DelegateLink.user_id == user_id)
            ).first()
            if existing:
                existing.delegate_address = s.delegate_address
                existing.encrypted_key_material = encrypted
                existing.active = True
                sess.add(existing)
            else:
                sess.add(
                    DelegateLink(
                        user_id=user_id,
                        delegate_address=s.delegate_address,
                        encrypted_key_material=encrypted,
                        active=True,
                    )
                )
            sess.commit()

        try:
            _notify_telegram(
                s.telegram_id,
                f"✅ Wallet connected: `{address}`\n"
                f"On-chain tx: `{tx}`\n"
                "Type a trade — e.g. `long $100 ETH 5x` — or /positions to view.",
            )
        except Exception as e:
            print(f"telegram notify failed: {e}")

        return web.json_response({"ok": True, "tx": tx})
    except Exception as e:
        import logging
        logging.getLogger("veranta-bot.connect").exception("submit failed")
        return web.json_response(
            {"error": f"{type(e).__name__}: {str(e)[:300]}"}, status=500
        )


def _notify_telegram(tg_id: str, text: str) -> None:
    import os
    import httpx
    from .config import TELEGRAM_BOT_TOKEN

    token = os.environ.get("TELEGRAM_BOT_TOKEN") or TELEGRAM_BOT_TOKEN
    httpx.post(
        f"https://api.telegram.org/bot{token}/sendMessage",
        json={"chat_id": int(tg_id), "text": text, "parse_mode": "Markdown"},
        timeout=10,
    )


def telegram_user_upsert(tg_id: str, wallet: str) -> int:
    """Get or create the User; persist wallet. Returns user.id."""
    from sqlmodel import select
    from .db import User, Policy, get_session

    with get_session() as s:
        u = s.exec(select(User).where(User.telegram_id == tg_id)).first()
        if u is None:
            u = User(telegram_id=tg_id, wallet_address=wallet.lower())
            s.add(u)
            s.commit()
            s.refresh(u)
            s.add(Policy(user_id=u.id))
            s.commit()
        elif u.wallet_address != wallet.lower():
            u.wallet_address = wallet.lower()
            s.add(u)
            s.commit()
        return int(u.id)  # type: ignore


def make_app() -> web.Application:
    app = web.Application()
    app.router.add_get("/api/connect/{sid}/intent", handle_intent)
    app.router.add_post("/api/connect/{sid}/prepare", handle_prepare)
    app.router.add_post("/api/connect/{sid}/submit", handle_submit)
    return app


def run(port: int = 8791) -> None:
    web.run_app(make_app(), host="127.0.0.1", port=port)


if __name__ == "__main__":
    run()
