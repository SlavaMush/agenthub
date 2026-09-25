"""Web API (localhost, behind Caddy): wallet sign-in, gasless signed intents, policy, chat, owner fee setup."""
import logging
import time

from aiohttp import web
from eth_abi import encode as abi_encode
from eth_account import Account
from eth_account.messages import encode_defunct
from eth_utils import keccak, to_bytes
from veranta_sdk import AsyncVeranta
from veranta_sdk.types import CallData

from . import core
from .db import BUILDER, NETWORK, POLICY, REFERRAL_CODE, TREASURY, User, encrypt, get_user, journal, read_token, save, sign_token

log = logging.getLogger("agenthub.api")
DELEGATE_TTL = 30 * 86400
EOA_ONLY = "Veranta needs a plain wallet key (MetaMask, Rabby, Rainbow, Coinbase Wallet EOA); smart wallets can't sign these."
# kind -> (tx-builder intent path, on-chain WithSig entry point, who may request it)
INTENTS = {
    "delegate": ("/v2/intents/delegate-set", "setDelegateWithSig(bytes,bytes)", "any"),
    "referral": ("/v2/intents/referral-set-code", "setTraderReferralCodeByUserWithSig(bytes,bytes)", "any"),
    "referrer": ("/v2/intents/referral-register-code", "registerCodeWithSig(bytes,bytes)", "owner"),
}
_signing: dict[tuple[str, str], tuple] = {}  # (wallet, kind) -> (expires, intent payload, relay key)
routes = web.RouteTableDef()


def err(msg: str, status: int = 400) -> web.Response:
    return web.json_response({"error": msg}, status=status)


def recover(sig: str, *, text: str = "", digest: str = "") -> str:
    try:
        if text:
            return Account.recover_message(encode_defunct(text=text), signature=sig).lower()
        return Account._recover_hash(bytes.fromhex(digest.removeprefix("0x")), signature=sig).lower()
    except Exception:
        return ""


@web.middleware
async def guard(req: web.Request, handler):
    try:
        if req.path != "/api/login":
            wallet = read_token(req.headers.get("Authorization", "").removeprefix("Bearer "), "s-")
            if not wallet:
                return err("session expired, sign in again", 401)
            req["user"] = get_user(wallet=wallet) or save(User(wallet=wallet))
        return await handler(req)
    except Exception as e:
        log.exception("%s failed", req.path)
        return err(f"{type(e).__name__}: {str(e)[:200]}", 500)


@routes.post("/api/login")
async def login(req):
    b = await req.json()
    wallet, ts = str(b.get("wallet", "")).lower(), int(b.get("ts", 0))
    if abs(time.time() - ts) > 300:
        return err("sign-in message expired, try again")
    if recover(b.get("signature", ""), text=f"Sign in to AgentHub\nWallet: {b.get('wallet')}\nIssued: {ts}") != wallet:
        return err(EOA_ONLY, 403)
    u = get_user(wallet=wallet) or save(User(wallet=wallet))
    if tg := read_token(b.get("tg", ""), "tg-"):
        if (other := get_user(telegram_id=tg)) and other.id != u.id:
            other.telegram_id = None
            save(other)
        u.telegram_id = tg
        save(u)
    return web.json_response({"token": sign_token(f"s-{wallet}", 7 * 86400), "telegram": bool(tg)})


@routes.get("/api/me")
async def me(req):
    u: User = req["user"]
    out = {"wallet": u.wallet, "active": u.active, "expires": u.delegate_expiry, "paused": u.paused,
           "telegram": bool(u.telegram_id), "referred": u.referred, "referralCode": REFERRAL_CODE,
           "policy": {k: getattr(u, k) for k in POLICY}}
    try:
        async with core.client(u) as c:
            a = await c.account._engine.addresses()
            spenders = [a["tradingStorage"]] + ([a["builderCode"]] if await core.fees() else [])
            allow = [await c.account.allowance(s) for s in spenders]
            if u.wallet == TREASURY:
                out["owner"] = {"feePercent": BUILDER.get("builder_fee_percent", 0),
                                "builder": await c.account.builder_code(BUILDER["builder_code"]) if BUILDER else None,
                                "referral": await c.info.referral_stats(u.wallet)}
        out |= {"usdc": a["usdc"], "balance": float(allow[0].get("balanceUsdc") or 0),
                "approvals": [{"spender": s, "allowance": float(x.get("allowanceUsdc") or 0)} for s, x in zip(spenders, allow)],
                **await core.portfolio(u)}
    except Exception as e:
        log.warning("chain read failed for %s: %s", u.wallet, e)
    return web.json_response(out)


@routes.post("/api/policy")
async def policy(req):
    u, b = req["user"], await req.json()
    for k in POLICY:
        if k in b:
            if not 0 < float(b[k]) <= 1e6:
                return err(f"{k} must be a positive number")
            setattr(u, k, int(b[k]) if k == "max_positions" else float(b[k]))
    if "paused" in b:
        u.paused = bool(b["paused"])
    save(u)
    return web.json_response({"ok": True})


@routes.post("/api/sign/{kind}/prepare")
async def sign_prepare(req):
    u, kind = req["user"], req.match_info["kind"]
    if kind not in INTENTS or (INTENTS[kind][2] == "owner" and u.wallet != TREASURY):
        return err("not allowed", 403)
    key = Account.create()  # fresh key: becomes the delegate, or just relays the gasless call
    params = {"delegate": {"trader": u.wallet, "delegate": key.address, "expirySeconds": int(time.time()) + DELEGATE_TTL},
              "referral": {"referee": u.wallet, "code": REFERRAL_CODE},
              "referrer": {"referrer": u.wallet, "code": REFERRAL_CODE}}[kind]
    async with AsyncVeranta(network=NETWORK, private_key=key.key.hex()) as c:
        p = await c.account._txb.intent(INTENTS[kind][0], **params)
    _signing[(u.wallet, kind)] = (time.time() + 900, p, key.key.hex())
    return web.json_response({"domain": p.domain, "types": p.types, "primaryType": p.primary_type, "message": p.message})


@routes.post("/api/sign/{kind}/submit")
async def sign_submit(req):
    u, kind = req["user"], req.match_info["kind"]
    exp, p, key = _signing.pop((u.wallet, kind), (0, None, None))
    sig = (await req.json()).get("signature", "")
    if exp < time.time():
        return err("request expired, start again")
    if recover(sig, digest=p.digest) != u.wallet:
        return err(EOA_ONLY, 403)
    data = keccak(text=INTENTS[kind][1])[:4] + abi_encode(["bytes", "bytes"], [to_bytes(hexstr=sig), to_bytes(hexstr=p.encoded_intent)])
    async with AsyncVeranta(network=NETWORK, private_key=key) as c:  # relayed via the key's EIP-7702 account: gasless
        a = c.account
        r = await a._route(CallData.model_validate({
            "to": p.domain["verifyingContract"], "from": a._engine.signer.address, "data": "0x" + data.hex(),
            "value": "0x0", "chainId": await a._engine.chain_id(), "description": kind}), wait=True)
    if kind == "delegate":
        u.delegate_key, u.delegate_expiry = encrypt(key), int(time.time()) + DELEGATE_TTL - 3600
    u.referred = u.referred or kind == "referral"
    save(u)
    journal(u.id, kind, tx=r.tx_hash)
    return web.json_response({"ok": True, "tx": r.tx_hash})


@routes.post("/api/owner/{action}")
async def owner_tx(req):
    """Unsigned tx for the treasury wallet to send itself (msg.sender-scoped actions)."""
    u, action = req["user"], req.match_info["action"]
    if u.wallet != TREASURY or action not in ("builder", "claim") or (action == "builder" and not BUILDER):
        return err("not allowed", 403)
    async with core.client() as c:
        if action == "claim":
            cd = await c.account._txb.calldata("/v2/referral/claim-rebate", caller=u.wallet)
        else:
            registered = (await c.account.builder_code(BUILDER["builder_code"]))["registered"]
            fee = BUILDER["builder_fee_percent"]
            cd = await c.account._txb.calldata(f"/v2/misc/builder-code/{'modify' if registered else 'register'}",
                                                caller=u.wallet, code=BUILDER["builder_code"], feeCollector=u.wallet,
                                                maxOpenFeePercent=fee, maxCloseFeePercent=fee, maxPnlCloseFeePercent=fee)
    core._fees["checked"] = 0  # re-check registration on the next trade
    return web.json_response({"to": cd.to, "data": cd.data, "value": cd.value})


@routes.post("/api/chat")
async def chat(req):
    reply, token = await core.chat(req["user"], str((await req.json()).get("text", ""))[:500])
    return web.json_response({"reply": reply, "token": token})


@routes.post("/api/confirm")
async def confirm(req):
    return web.json_response({"reply": await core.confirm(req["user"], (await req.json()).get("token", ""))})


def make_app() -> web.Application:
    app = web.Application(middlewares=[guard], client_max_size=64 * 1024)
    app.add_routes(routes)
    return app
