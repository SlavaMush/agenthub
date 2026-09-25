"""Web API (localhost, behind Caddy): wallet sign-in, account, gasless signed intents, chat, x402-paid agent execution."""
import logging
import time

from aiohttp import web

from . import account, core, x402pay
from .db import User, get_user, read_token, save, sign_token

log = logging.getLogger("agenthub.api")
AGENT_TOKEN_TTL = 30 * 86400
PUBLIC = {"/api/login", "/api/status", "/api/onboard/prepare", "/api/onboard/submit"}  # the rest needs a session
routes = web.RouteTableDef()


def err(msg: str, status: int = 400) -> web.Response:
    return web.json_response({"error": msg}, status=status)


def session_token(u: User, ttl: int) -> str:
    return sign_token(f"s-{u.wallet}:{u.token_version}", ttl)


def user_from_token(authorization: str):
    wallet, _, version = (read_token((authorization or "").removeprefix("Bearer "), "s-") or "").partition(":")
    u = get_user(wallet=wallet) if wallet else None
    return u if u and str(u.token_version) == version else None


@web.middleware
async def guard(req: web.Request, handler):
    try:
        if req.path not in PUBLIC:
            if not (u := user_from_token(req.headers.get("Authorization", ""))):
                return err("session expired, sign in again", 401)
            req["user"] = u
        return await handler(req)
    except web.HTTPException:
        raise  # 404/405 etc. keep their status
    except account.UserError as e:
        return err(str(e))
    except Exception as e:
        log.exception("%s failed", req.path)
        return err(f"{type(e).__name__}: {str(e)[:200]}", 500)


@routes.post("/api/login")
async def login(req):
    b = await req.json()
    wallet, ts = str(b.get("wallet", "")).lower(), int(b.get("ts", 0))
    if abs(time.time() - ts) > 300:
        return err("sign-in message expired, try again")
    if account.recover(b.get("signature", ""), text=account.login_message(b.get("wallet"), ts)) != wallet:
        return err(account.EOA_ONLY, 403)
    u = get_user(wallet=wallet) or save(User(wallet=wallet))
    if tg := read_token(b.get("tg", ""), "tg-"):
        if (other := get_user(telegram_id=tg)) and other.id != u.id:
            other.telegram_id = None
            save(other)
        u.telegram_id = tg
        save(u)
    ttl = AGENT_TOKEN_TTL if b.get("agent") else 7 * 86400
    return web.json_response({"token": session_token(u, ttl), "expires": int(time.time()) + ttl, "telegram": bool(tg)})


@routes.get("/api/status")
async def status(req):
    """Public: does this wallet already have a live trading key? Picks 'Sign in' vs 'Set up' (one signature either way)."""
    u = get_user(wallet=req.query.get("wallet", "").lower())
    return web.json_response({"active": bool(u and u.active)})


@routes.post("/api/onboard/prepare")
async def onboard_prepare(req):
    return web.json_response(await account.prepare_delegation(str((await req.json()).get("wallet", ""))))


@routes.post("/api/onboard/submit")
async def onboard_submit(req):
    """New users sign once: the verified delegation signature enables trading AND signs them in."""
    b = await req.json()
    u, tx = await account.submit_delegation(b.get("ref", ""), b.get("signature", ""))
    if b.get("policy"):
        account.set_policy(u, b["policy"])
    return web.json_response({"tx": tx, "token": session_token(u, 7 * 86400), "expires": int(time.time()) + 7 * 86400})


@routes.get("/api/me")
async def me(req):
    return web.json_response(await account.summary(req["user"]))


@routes.post("/api/agent/token")
async def agent_token(req):
    """30-day token for an agent or MCP client acting for this wallet."""
    return web.json_response({"token": session_token(req["user"], AGENT_TOKEN_TTL), "expires": int(time.time()) + AGENT_TOKEN_TTL})


@routes.post("/api/agent/revoke")
async def agent_revoke(req):
    """Invalidate every token for this wallet (agents and browser sessions); sign in again afterwards."""
    u = req["user"]
    u.token_version += 1
    save(u)
    return web.json_response({"ok": True})


@routes.post("/api/policy")
async def policy(req):
    account.set_policy(req["user"], await req.json())
    return web.json_response({"ok": True})


@routes.get("/api/approvals")
async def approvals(req):
    return web.json_response({"transactions": await account.wallet_txs(req["user"], float(req.query.get("amount", 1000)))})


@routes.post("/api/referral/linked")
async def referral_linked(req):
    """The wallet sent the referral set-code tx itself; just stop offering it."""
    account.mark_referred(req["user"])
    return web.json_response({"ok": True})


@routes.post("/api/delegate/prepare")
async def delegate_prepare(req):
    """Signed-in users renewing their key (and agents via MCP): same flow, bound to the session's wallet."""
    return web.json_response(await account.prepare_delegation(req["user"].wallet))


@routes.post("/api/delegate/submit")
async def delegate_submit(req):
    b = await req.json()
    u, tx = await account.submit_delegation(b.get("ref", ""), b.get("signature", ""))
    if u.wallet != req["user"].wallet:
        return err("that request belongs to another wallet", 403)
    return web.json_response({"ok": True, "tx": tx})


@routes.post("/api/chat")
async def chat(req):
    reply, token = await core.chat(req["user"], str((await req.json()).get("text", ""))[:500])
    return web.json_response({"reply": reply, "token": token})


@routes.post("/api/confirm")
async def confirm(req):
    reply, ok = await core.confirm(req["user"], (await req.json()).get("token", ""))
    return web.json_response({"reply": reply, "executed": ok})


@routes.post("/api/agent/execute")
async def agent_execute(req):
    """Same as /api/confirm, but x402-paid: agents pay per executed trade, nothing if it doesn't execute."""
    token = (await req.json()).get("token", "")
    return await x402pay.charge(req, lambda: core.confirm(req["user"], token))


def make_app() -> web.Application:
    app = web.Application(middlewares=[guard], client_max_size=64 * 1024)
    app.add_routes(routes)
    return app
