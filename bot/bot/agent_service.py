"""HTTP surface: the agent endpoint shared with Telegram.

Mount onto an aiohttp app. Uses the shared core — no trading logic lives here.
"""
import logging

from aiohttp import web

from .core import (
    ChatResult,
    chat,
    execute_pending,
    get_user_by_wallet,
)
from .executor import Executor

log = logging.getLogger("veranta-bot.agent")


def mount(app: web.Application, executor: Executor) -> None:
    app["executor"] = executor
    app.router.add_post("/agent/chat", handle_chat)
    app.router.add_get("/agent/positions", handle_positions)
    app.router.add_post("/agent/confirm", handle_confirm)
    app.router.add_get("/agent/status", handle_status)
    app.router.add_get("/agent/wallet", handle_wallet)
    # Onboarding: build + submit delegate-set signature
    from . import onboard
    onboard.mount_onboard(app)
    for path in ("/agent/chat", "/agent/positions", "/agent/confirm", "/agent/status", "/agent/wallet"):
        app.router.add_options(path, handle_options)


async def handle_status(request: web.Request) -> web.Response:
    """Cheap probe for frontend: does this wallet have an ACTIVE on-chain delegate?

    `registered` is True only when we have an ACTIVE DelegateLink — that means
    the user's sign + relay both succeeded and the backend has a private key on
    file to execute as delegate. An INACTIVE link means they prepared but never
    finished (or submit failed) → UX should re-prompt onboarding.
    """
    user, policy = get_user_by_wallet(request.headers.get("X-Wallet-Address", ""))
    active_link = False
    if user:
        from .db import DelegateLink, get_session
        from sqlmodel import select
        with get_session() as s:
            active_link = bool(s.exec(
                select(DelegateLink).where(
                    DelegateLink.user_id == user.id,
                    DelegateLink.active == True,  # noqa: E712
                )
            ).first())
    return web.json_response({
        "registered": active_link,
        "paused": bool(policy and policy.paused),
    })


async def handle_options(request: web.Request) -> web.Response:
    return web.Response(status=204)


async def handle_chat(request: web.Request) -> web.Response:
    body = await request.json()
    text = (body.get("text") or "").strip()
    user, policy = get_user_by_wallet(request.headers.get("X-Wallet-Address", ""))
    if not user or not policy:
        return web.json_response(
            {
                "reply": "Connect + finish onboarding at agenthub.gg first. We'll ask you to sign once.",
                "needs_connect": True,
            },
            status=401,
        )

    # Incomplete onboarding gate — DB user exists but no ACTIVE delegate link.
    from .db import DelegateLink, get_session
    from sqlmodel import select
    with get_session() as s:
        active = bool(s.exec(
            select(DelegateLink).where(
                DelegateLink.user_id == user.id, DelegateLink.active == True,  # noqa: E712
            )
        ).first())
    if not active:
        return web.json_response(
            {
                "reply": "Onboarding is half-done on your side. Hit the home page, re-sign, and we'll finish the delegate.",
                "needs_connect": True,
            },
            status=401,
        )

    result: ChatResult = await chat(text, user, policy)
    out: dict = {"reply": result.reply}
    if result.token:
        out["token"] = result.token
        out["needs_confirm"] = True
        out["ttl_seconds"] = result.ttl_seconds
    return web.json_response(out)


async def handle_confirm(request: web.Request) -> web.Response:
    body = await request.json()
    token = (body.get("token") or "").strip()
    user, _ = get_user_by_wallet(request.headers.get("X-Wallet-Address", ""))
    if not user:
        return web.json_response({"error": "no-user"}, status=401)
    ex: Executor = request.app["executor"]
    res = await execute_pending(token, user, ex)
    out = {"reply": res.reply}
    if res.tx:
        out["tx"] = res.tx
    return web.json_response(out, status=200 if res.ok else 400)


async def handle_wallet(request: web.Request) -> web.Response:
    """USDC balance + allowance for the caller's EOA (read-only, no policy check needed)."""
    user, _ = get_user_by_wallet(request.headers.get("X-Wallet-Address", ""))
    if not user:
        return web.json_response({"error": "no-user"}, status=401)
    ex: Executor = request.app["executor"]
    try:
        data = await ex.wallet_state(trader=user.wallet_address)
    except Exception as e:
        log.exception("wallet_state failed: %s", e)
        return web.json_response({"error": f"read-failed: {e}"}, status=502)
    return web.json_response(data)


async def handle_positions(request: web.Request) -> web.Response:
    user, _ = get_user_by_wallet(request.headers.get("X-Wallet-Address", ""))
    if not user:
        return web.json_response({"error": "no-user"}, status=401)
    ex: Executor = request.app["executor"]
    data = await ex.positions(trader=user.wallet_address)
    return web.json_response(
        {
            "positions": [
                {
                    "pair_index": p.pair_index,
                    "index": p.index,
                    "side": p.side,
                    "collateral": float(p.collateral),
                    "open_price": float(p.open_price),
                    "liquidation_price": float(p.liquidation_price),
                }
                for p in data.positions
            ]
        }
    )

