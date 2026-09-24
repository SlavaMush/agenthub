"""Onboarding endpoint: user signs ONE EIP-712 that registers a per-user delegate key.

Flow (matches Base/Coinbase docs for Smart-Wallet voices):
1. POST /prepare with trader address → we generate a fresh delegate keypair,
   store the encrypted privkey in DelegateLink (inactive), build the EIP-712
   DelegateReq payload via Veranta tx-builder, return it for the wallet to sign.
2. POST /submit with trader+signature+encodedIntent+policy → we verify the
   signature on-chain via the ERC-6492 Universal Validator, then relay the
   setDelegateWithSig call through the relayer. On success the DelegateLink
   is marked active; either way the user's chosen policy is saved.
"""
import logging
import os

from aiohttp import web
from sqlmodel import select

from .config import NETWORK
from .connect import encrypt_secret
from .db import DelegateLink, Journal, Policy, User, get_session
from .delegate_registration import (
    build_delegate_typed_data, default_expiry, new_delegate_key_and_address,
    submit_delegate_registration,
)

log = logging.getLogger("veranta-bot.onboard")

DELEGATE_TTL_DAYS = 30


def _journal(uid: int, kind: str, payload: dict) -> None:
    try:
        import json
        with get_session() as s:
            s.add(Journal(user_id=uid, kind=kind, payload=json.dumps(payload)))
            s.commit()
    except Exception:
        log.exception("journal write failed")


def _get_or_create_user(trader: str) -> int:
    with get_session() as s:
        u = s.exec(select(User).where(User.wallet_address == trader)).first()
        if u is None:
            u = User(wallet_address=trader)
            s.add(u); s.commit(); s.refresh(u)
            s.add(Policy(user_id=u.id))
            s.commit()
        return int(u.id)


def _save_policy(uid: int, policy_in: dict) -> None:
    with get_session() as s:
        p = s.exec(select(Policy).where(Policy.user_id == uid)).first()
        if p is None:
            p = Policy(user_id=uid)
        p.max_leverage = int(policy_in.get("max_leverage", 5))
        p.max_collateral_per_trade = float(policy_in.get("max_size_usd", 100))
        p.max_notional_per_day = float(policy_in.get("max_daily_usd", 500))
        p.max_open_positions = int(policy_in.get("max_positions", 3))
        p.daily_loss_limit = float(policy_in.get("max_daily_loss_usd", 50))
        s.add(p); s.commit()


def _save_pending_link(uid: int, encrypted_key: str, delegate_addr: str, expiry: int, digest: str) -> None:
    """Save the freshly generated keypair as pending (inactive) for this user."""
    with get_session() as s:
        existing = s.exec(
            select(DelegateLink).where(DelegateLink.user_id == uid)
        ).first()
        if existing:
            existing.delegate_address = delegate_addr
            existing.encrypted_key_material = encrypted_key
            existing.expiry_unix = expiry
            existing.pending_digest = digest
            existing.active = False  # will flip to True on submit success
            s.add(existing)
        else:
            s.add(DelegateLink(
                user_id=uid, delegate_address=delegate_addr,
                encrypted_key_material=encrypted_key, expiry_unix=expiry,
                pending_digest=digest, active=False,
            ))
        s.commit()


def _mark_link_active(uid: int, delegate_addr: str, *, ok: bool, digest_clear: bool = True) -> None:
    with get_session() as s:
        dl = s.exec(
            select(DelegateLink).where(
                DelegateLink.user_id == uid, DelegateLink.delegate_address == delegate_addr
            )
        ).first()
        if dl:
            dl.active = ok
            if ok and digest_clear:
                dl.pending_digest = ""
            s.add(dl); s.commit()


def _get_pending(uid: int) -> dict | None:
    with get_session() as s:
        dl = s.exec(select(DelegateLink).where(DelegateLink.user_id == uid)).first()
        if not dl or dl.active:
            return None
        try:
            from .connect import decrypt_secret
            pk = decrypt_secret(dl.encrypted_key_material, os.environ["VERANTA_CONNECT_MASTER_KEY"])
        except Exception:
            return None
        return {
            "delegate_private_key": pk,
            "delegate_address": dl.delegate_address,
            "expiry": dl.expiry_unix,
            "digest": dl.pending_digest,
        }


async def handle_prepare(request: web.Request) -> web.Response:
    body = await request.json()
    trader = (body.get("trader") or "").strip().lower()
    if not trader.startswith("0x") or len(trader) != 42:
        return web.json_response({"error": "bad trader address"}, status=400)

    try:
        uid = _get_or_create_user(trader)
        delegate_pk, delegate_address = new_delegate_key_and_address()
        expiry = default_expiry(days=DELEGATE_TTL_DAYS)
        td = await build_delegate_typed_data(
            trader=trader, delegate=delegate_address, expiry_timestamp=expiry,
            relayer_private_key=delegate_pk, network=NETWORK,
        )
        master = os.environ["VERANTA_CONNECT_MASTER_KEY"]
        encrypted = encrypt_secret(delegate_pk, master)
        _save_pending_link(uid, encrypted, delegate_address, expiry, td.get("digest", ""))
    except Exception as e:
        log.exception("prepare failed for %s", trader)
        return web.json_response({"error": f"{type(e).__name__}: {str(e)[:200]}"}, status=500)
    return web.json_response(td)


async def handle_submit(request: web.Request) -> web.Response:
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "invalid json"}, status=400)
    trader = (body.get("trader") or "").strip().lower()
    sig_hex = (body.get("signature") or "").strip()
    encoded_intent = (body.get("encodedIntent") or "").strip()
    policy_in = body.get("policy") or {}

    if not (trader and sig_hex.startswith("0x") and encoded_intent.startswith("0x")):
        return web.json_response({"error": "missing fields"}, status=400)
    if len(sig_hex) < 2 + 2 * 65:
        return web.json_response({"error": "bad signature"}, status=400)

    uid = _get_or_create_user(trader)
    pend = _get_pending(uid)
    if not pend:
        return web.json_response({"error": "no pending registration; call /prepare first"}, status=400)

    # Save user's chosen policy up-front (so settings persist even if on-chain tx
    # hits a non-fatal error like nonce-too-low that can be retried).
    _save_policy(uid, policy_in)

    # Pre-verify the signature on-chain via ERC-6492 Universal Validator.
    digest = pend.get("digest") or ""
    rpc_url = os.environ.get("VERANTA_RPC_URL") or "https://mainnet.base.org"
    if digest:
        from .sigverify import verify_signature
        ok, reason = await verify_signature(
            rpc_url=rpc_url, signer=trader,
            digest_bytes=bytes.fromhex(digest[2:]), signature_hex=sig_hex,
        )
        if not ok:
            log.warning("sig pre-verify failed for %s: %s", trader, reason)
            return web.json_response({"error": f"signature not valid on-chain: {reason}"}, status=400)

    try:
        res = await submit_delegate_registration(
            trader=trader,
            delegate=pend["delegate_address"],
            expiry_timestamp=int(pend["expiry"]),
            signature=sig_hex,
            encoded_intent=encoded_intent,
            relayer_private_key=pend["delegate_private_key"],
            network=NETWORK,
        )
    except Exception as e:
        log.exception("submit delegate failed for %s", trader)
        # Leave the pending link inactive so /agent/status shows "delegation pending"
        # and the user can retry.
        return web.json_response({"error": f"{type(e).__name__}: {str(e)[:200]}"}, status=500)

    _mark_link_active(uid, pend["delegate_address"], ok=True)
    _journal(uid, "onboard", {
        "policy": policy_in, "tx": res.tx_hash,
        "delegate": res.delegate_address, "expiry": res.expiry_timestamp,
    })
    return web.json_response({"ok": True, "trader": trader, "tx": res.tx_hash})


async def _handle_options(request: web.Request) -> web.Response:
    return web.Response(status=204)


def mount_onboard(app: web.Application) -> None:
    app.router.add_post("/api/onboard/prepare", handle_prepare)
    app.router.add_post("/api/onboard/submit", handle_submit)
    app.router.add_options("/api/onboard/prepare", _handle_options)
    app.router.add_options("/api/onboard/submit", _handle_options)
