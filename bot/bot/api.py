"""Web API (localhost, behind Caddy): wallet sign-in, account, gasless signed intents, chat, x402-paid agent execution."""
import logging
import time

from aiohttp import web

from . import account, core, x402pay
from .db import User, get_user, read_token, save, sign_token

log = logging.getLogger("agenthub.api")
AGENT_TOKEN_TTL = 30 * 86400
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
        if req.path != "/api/login":
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


@routes.post("/api/sign/{kind}/prepare")
@routes.post("/api/delegate/prepare")  # path used by site builds before the referral step
async def sign_prepare(req):
    return web.json_response(await account.prepare_intent(req["user"], req.match_info.get("kind", "delegate")))


@routes.post("/api/sign/{kind}/submit")
@routes.post("/api/delegate/submit")
async def sign_submit(req):
    kind, sig = req.match_info.get("kind", "delegate"), (await req.json()).get("signature", "")
    return web.json_response({"ok": True, "tx": await account.submit_intent(req["user"], kind, sig)})


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
