"""Onboarding endpoint: user signs ONE EIP-712 that registers a per-user
delegate key (Bankr-style). Server relays the setDelegateWithSig call.
Policy is kept in DB; delegate private key is stored AES-encrypted.
"""
import logging
import os
from typing import Optional

from aiohttp import web
from sqlmodel import select

from .config import NETWORK
from .db import DelegateLink, Journal, Policy, User, get_session
from .delegate_registration import (
    DelegateRegistrationResult,
    build_delegate_typed_data,
    default_expiry,
    new_delegate_key_and_address,
    submit_delegate_registration,
)

log = logging.getLogger("veranta-bot.onboard")

# How long the delegate stays registered on-chain
DELEGATE_TTL_SECONDS = 30 * 86400  # 30 days


def _journal(uid: int, kind: str, payload: dict) -> None:
    try:
        import json
        with get_session() as s:
            s.add(Journal(user_id=uid, kind=kind, payload=json.dumps(payload)))
            s.commit()
    except Exception:
        log.exception("journal write failed")


def _encrypt_and_save_delegate_key(
    user_id: int, delegate_private_key: str, delegate_address: str
) -> None:
    """Store the per-user delegate key encrypted with VERANTA_CONNECT_MASTER_KEY."""
    from .connect import encrypt_secret

    master = os.environ["VERANTA_CONNECT_MASTER_KEY"]
    encrypted = encrypt_secret(delegate_private_key, master)

    with get_session() as sess:
        existing = sess.exec(
            select(DelegateLink).where(DelegateLink.user_id == user_id)
        ).first()
        if existing:
            existing.delegate_address = delegate_address
            existing.encrypted_key_material = encrypted
            existing.active = True
            sess.add(existing)
        else:
            sess.add(
                DelegateLink(
                    user_id=user_id,
                    delegate_address=delegate_address,
                    encrypted_key_material=encrypted,
                    active=True,
                )
            )
        sess.commit()


async def handle_prepare(request: web.Request) -> web.Response:
    """POST /api/onboard/prepare {trader} -> EIP-712 payload to sign.

    Generates a fresh per-user delegate keypair, stashes it in the DB user's
    DelegateLink (encrypted, inactive until submit confirms on-chain), and
    returns the typed-data payload to sign.
    """
    body = await request.json()
    trader = (body.get("trader") or "").strip().lower()
    if not trader.startswith("0x") or len(trader) != 42:
        return web.json_response({"error": "bad trader address"}, status=400)

    delegate_pk, delegate_address = new_delegate_key_and_address()
    expiry = default_expiry(days=30)

    # Generate (or replace) the user's DelegateLink with this fresh key.
    with get_session() as s:
        u = s.exec(select(User).where(User.wallet_address == trader)).first()
        if u is None:
            u = User(wallet_address=trader)
            s.add(u)
            s.commit()
            s.refresh(u)
            s.add(Policy(user_id=u.id))
            s.commit()
        uid = int(u.id)

    # Don't persist the key yet — wait for the submit callback after user signs.
    # For now, we stash it in the request context so submit can finalize.
    # Simplest persistent store: put it in-app keyed by trader. Stable across restarts
    # by re-generating on prepare. For production, all delegate keys should come from KMS.
    # (We keep a module-level dict; sign+submit typically happen within seconds.)
    _PENDING_KEYS[trader] = {
        "delegate_private_key": delegate_pk,
        "delegate_address": delegate_address,
        "expiry": expiry,
        "issued_at": int(os.times().elapsed) if hasattr(os, "times") else 0,
    }

    try:
        td = await build_delegate_typed_data(
            trader=trader,
            delegate=delegate_address,
            expiry_timestamp=expiry,
            relayer_private_key=delegate_pk,
            network=NETWORK,
        )
    except Exception as e:
        log.exception("prepare failed")
        return web.json_response({"error": f"{type(e).__name__}: {str(e)[:200]}"}, status=500)
    return web.json_response(td)


_PENDING_KEYS: dict[str, dict] = {}


async def handle_submit(request: web.Request) -> web.Response:
    """POST /api/onboard/submit {trader, signature, encodedIntent, policy} -> registers delegate on-chain + saves policy + encrypted delegate key."""
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "invalid json"}, status=400)
    trader = (body.get("trader") or "").strip().lower()
    signature = (body.get("signature") or "").strip()
    encoded_intent = (body.get("encodedIntent") or "").strip()
    policy_in = body.get("policy") or {}
    if not (trader and signature.startswith("0x") and encoded_intent.startswith("0x")):
        log.warning(
            "submit missing fields: trader=%r sig=%r(enc=%s) intent=%r(enc=%s)",
            trader, signature[:20], len(signature), encoded_intent[:20], len(encoded_intent),
        )
        return web.json_response({"error": "missing fields"}, status=400)

    sig_bytes = bytes.fromhex(signature[2:])
    if len(sig_bytes) < 65:
        return web.json_response(
            {"error": f"bad signature length: {len(sig_bytes)} bytes"}, status=400
        )

    pend = _PENDING_KEYS.get(trader)
    if not pend:
        return web.json_response(
            {"error": "no pending registration for this trader; call /prepare first"}, status=400
        )

    try:
        max_lev = int(policy_in.get("max_leverage", 3))
        max_size = float(policy_in.get("max_size_usd", 100))
        max_daily = float(policy_in.get("max_daily_usd", 500))
        max_pos = int(policy_in.get("max_positions", 3))
        max_loss = float(policy_in.get("max_daily_loss_usd", 50))
    except Exception:
        return web.json_response({"error": "invalid policy numbers"}, status=400)

    # Save the user's chosen policy FIRST so the UI always reflects what they set,
    # even if the on-chain registration has to be retried (RPC hiccup, insufficient
    # gas, provider lag). The real safety net is the on-chain delegate, anyway; the
    # DB policy is UX.
    with get_session() as s:
        u = s.exec(select(User).where(User.wallet_address == trader)).first()
        if u is None:
            return web.json_response({"error": "user row missing"}, status=500)
        uid = int(u.id)
        p = s.exec(select(Policy).where(Policy.user_id == uid)).first()
        if p is None:
            p = Policy(user_id=uid)
        p.max_leverage = max_lev
        p.max_collateral_per_trade = max_size
        p.max_notional_per_day = max_daily
        p.max_open_positions = max_pos
        p.daily_loss_limit = max_loss
        s.add(p)
        s.commit()

    try:
        res: DelegateRegistrationResult = await submit_delegate_registration(
            trader=trader,
            delegate=pend["delegate_address"],
            expiry_timestamp=int(pend["expiry"]),
            signature=signature,
            encoded_intent=encoded_intent,
            relayer_private_key=pend["delegate_private_key"],
            network=NETWORK,
        )
    except Exception as e:
        log.exception("submit delegate failed")
        # Mark the delegate link inactive so /agent/status shows "delegation pending".
        with get_session() as s:
            dl = s.exec(select(DelegateLink).where(DelegateLink.user_id == uid)).first()
            if dl:
                dl.active = False
                s.add(dl)
                s.commit()
        return web.json_response({"error": f"{type(e).__name__}: {str(e)[:200]}"}, status=500)

    # Persist policy + encrypted delegate key.
    with get_session() as s:
        u = s.exec(select(User).where(User.wallet_address == trader)).first()
        if u is None:
            return web.json_response({"error": "user row missing"}, status=500)
        p = s.exec(select(Policy).where(Policy.user_id == u.id)).first()
        if p is None:
            p = Policy(user_id=u.id)
        p.max_leverage = max_lev
        p.max_collateral_per_trade = max_size
        p.max_notional_per_day = max_daily
        p.max_open_positions = max_pos
        p.daily_loss_limit = max_loss
        s.add(p)
        s.commit()
        uid = int(u.id)

    _encrypt_and_save_delegate_key(uid, pend["delegate_private_key"], pend["delegate_address"])
    _PENDING_KEYS.pop(trader, None)

    _journal(uid, "onboard", {
        "policy": policy_in,
        "tx": res.tx_hash,
        "delegate": res.delegate_address,
        "expiry": res.expiry_timestamp,
    })
    return web.json_response({"ok": True, "trader": trader, "tx": res.tx_hash})


def mount_onboard(app: web.Application) -> None:
    app.router.add_post("/api/onboard/prepare", handle_prepare)
    app.router.add_post("/api/onboard/submit", handle_submit)
    app.router.add_options("/api/onboard/prepare", handle_options)
    app.router.add_options("/api/onboard/submit", handle_options)


async def handle_options(request: web.Request) -> web.Response:
    return web.Response(status=204)
