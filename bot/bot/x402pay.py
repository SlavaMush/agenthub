"""x402 on Base mainnet: agents pay per executed trade, settled only if the trade executes.

Off (trades run unpaid) until X402_PAY_TO, CDP_API_KEY_ID and CDP_API_KEY_SECRET are set: Coinbase's
mainnet facilitator needs a CDP API key, the public x402.org facilitator is testnet-only.
"""
import asyncio
import base64
import json
import logging
import os
import secrets
import time

import jwt
from aiohttp import web
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519
from x402 import x402ResourceServer
from x402.http import HTTPFacilitatorClient, HTTPRequestContext, x402HTTPResourceServer
from x402.mechanisms.evm.exact import ExactEvmServerScheme

log = logging.getLogger("agenthub.x402")
FACILITATOR = "https://api.cdp.coinbase.com/platform/v2/x402"
PAY_TO = os.environ.get("X402_PAY_TO", "")
PRICE = os.environ.get("X402_PRICE", "$0.01")
KEY_ID, KEY_SECRET = os.environ.get("CDP_API_KEY_ID", ""), os.environ.get("CDP_API_KEY_SECRET", "")


def _cdp_headers() -> dict:
    """Short-lived JWTs for the CDP facilitator (same claims the cdp-sdk builds)."""
    if "BEGIN" in KEY_SECRET:
        key, alg = serialization.load_pem_private_key(KEY_SECRET.replace("\\n", "\n").encode(), None), "ES256"
    else:
        key, alg = ed25519.Ed25519PrivateKey.from_private_bytes(base64.b64decode(KEY_SECRET)[:32]), "EdDSA"

    def auth(method: str, op: str) -> dict:
        now = int(time.time())
        claims = {"sub": KEY_ID, "iss": "cdp", "nbf": now, "exp": now + 120,
                  "uris": [f"{method} api.cdp.coinbase.com/platform/v2/x402/{op}"]}
        token = jwt.encode(claims, key, algorithm=alg, headers={"kid": KEY_ID, "nonce": secrets.token_hex(16), "typ": "JWT"})
        return {"Authorization": f"Bearer {token}"}
    return {"verify": auth("POST", "verify"), "settle": auth("POST", "settle"), "supported": auth("GET", "supported"), "list": {}}


_server = None
if PAY_TO and KEY_ID and KEY_SECRET:
    _rs = x402ResourceServer(HTTPFacilitatorClient({"url": FACILITATOR, "create_headers": _cdp_headers}))
    _rs.register("eip155:8453", ExactEvmServerScheme())
    _server = x402HTTPResourceServer(_rs, {"POST /api/agent/execute": {
        "accepts": {"scheme": "exact", "payTo": PAY_TO, "price": PRICE, "network": "eip155:8453"},
        "description": "Execute a quoted AgentHub trade on Veranta perps (Base)", "mimeType": "application/json"}})
else:
    log.warning("x402 disabled: set X402_PAY_TO, CDP_API_KEY_ID and CDP_API_KEY_SECRET to charge agents")
_ready = asyncio.Lock()
_initialized = False


class _Request:
    """x402 HTTPAdapter over an aiohttp request (body already parsed)."""

    def __init__(self, req: web.Request, body):
        self.r, self.body = req, body

    def get_header(self, name): return self.r.headers.get(name)
    def get_method(self): return self.r.method
    def get_path(self): return self.r.path
    def get_url(self): return f"https://{self.r.host}{self.r.path_qs}"  # TLS terminates at Caddy
    def get_accept_header(self): return self.r.headers.get("accept", "")
    def get_user_agent(self): return self.r.headers.get("user-agent", "")
    def get_query_params(self): return dict(self.r.query)
    def get_query_param(self, name): return self.r.query.get(name)
    def get_body(self): return self.body


async def charge(req: web.Request, run) -> web.Response:
    """Verify an x402 payment, run the action, and settle only if it returned executed=True."""
    global _initialized
    if not _server:
        reply, ok = await run()
        return web.json_response({"reply": reply, "executed": ok, "paid": False})
    async with _ready:
        if not _initialized:
            await asyncio.to_thread(_server.initialize)  # fetches the facilitator's supported kinds once
            _initialized = True
    ctx = HTTPRequestContext(adapter=_Request(req, await req.json()), path=req.path, method=req.method,
                             payment_header=req.headers.get("payment-signature") or req.headers.get("x-payment"))
    result = await _server.process_http_request(ctx)
    if result.type == "payment-error":  # 402 with PAYMENT-REQUIRED, or an invalid payment
        r = result.response
        headers = {k: v for k, v in (r.headers or {}).items() if k.lower() != "content-type"}
        body = r.body if r.is_html else json.dumps(r.body or {})
        return web.Response(status=r.status, headers=headers, text=body,
                            content_type="text/html" if r.is_html else "application/json")
    reply, ok = await run()
    if not ok:  # nothing executed: the signed authorization is never settled, so the agent pays nothing
        return web.json_response({"reply": reply, "executed": False, "paid": False})
    s = await _server.process_settlement(result.payment_payload, result.payment_requirements, context=ctx)
    if not s.success:
        log.error("x402 settlement failed after executing for %s", req.get("user") and req["user"].wallet)
    return web.json_response({"reply": reply, "executed": True, "paid": bool(s.success)}, headers=s.headers or {})
