"""Account operations shared by the web API, the paid agent API and the MCP server."""
import logging
import time

from eth_abi import encode as abi_encode
from eth_account import Account
from eth_account.messages import encode_defunct
from eth_utils import keccak, to_bytes
from veranta_sdk import AsyncVeranta
from veranta_sdk.types import CallData

from . import core
from .db import NETWORK, POLICY, REFERRAL_CODE, User, decrypt, encrypt, journal, save

log = logging.getLogger("agenthub.account")
DELEGATE_TTL = 30 * 86400
EOA_ONLY = "Veranta needs a plain wallet key (MetaMask, Rabby, Rainbow, Coinbase Wallet EOA); smart wallets can't sign these."
# kind -> (tx-builder intent path, on-chain WithSig entry point). Referral linking is a plain wallet tx instead:
# Veranta's relayer rejects setTraderReferralCodeByUserWithSig unless the referee's own account relays it.
INTENTS = {"delegate": ("/v2/intents/delegate-set", "setDelegateWithSig(bytes,bytes)")}
_signing: dict[tuple[str, str], tuple] = {}  # (wallet, kind) -> (expires, intent payload, relay key)


class UserError(Exception):
    """A problem the caller can fix; transports return it as a 4xx."""


def login_message(wallet: str, ts: int) -> str:
    return f"Sign in to AgentHub\nWallet: {wallet}\nIssued: {ts}"


def recover(sig: str, *, text: str = "", digest: str = "") -> str:
    try:
        if text:
            return Account.recover_message(encode_defunct(text=text), signature=sig).lower()
        return Account._recover_hash(bytes.fromhex(digest.removeprefix("0x")), signature=sig).lower()
    except Exception:
        return ""


async def summary(u: User) -> dict:
    out = {"wallet": u.wallet, "active": u.active, "expires": u.delegate_expiry, "paused": u.paused,
           "telegram": bool(u.telegram_id), "referred": u.referred, "referralCode": REFERRAL_CODE,
           "policy": {k: getattr(u, k) for k in POLICY}}
    try:
        async with core.client(u) as c:
            a = await c.account._engine.addresses()
            spenders = [a["tradingStorage"]] + ([a["builderCode"]] if await core.fees() else [])
            allow = [await c.account.allowance(s) for s in spenders]
            if u.active:  # trust the chain: the user may have revoked the key at delegate.veranta.xyz
                st = await c.account.delegation_status(Account.from_key(decrypt(u.delegate_key)).address)
                out["active"], out["expires"] = bool(st.get("canSignIntents")), int(st.get("expiry") or 0)
        out |= {"usdc": a["usdc"], "balance": float(allow[0].get("balanceUsdc") or 0),
                "approvals": [{"spender": s, "allowance": float(x.get("allowanceUsdc") or 0)} for s, x in zip(spenders, allow)],
                **await core.portfolio(u)}
    except Exception as e:
        log.warning("chain read failed for %s: %s", u.wallet, e)
    return out


def set_policy(u: User, b: dict) -> None:
    for k in POLICY:
        if b.get(k) is not None:
            if not 0 < float(b[k]) <= 1e6:
                raise UserError(f"{k} must be a positive number")
            setattr(u, k, int(b[k]) if k == "max_positions" else float(b[k]))
    if b.get("paused") is not None:
        u.paused = bool(b["paused"])
    save(u)


async def wallet_txs(u: User, amount_usdc: float) -> list[dict]:
    """Transactions only the trader's own wallet can send: USDC approvals (collateral + our builder fee), plus the
    optional referral link for Veranta's fee discount."""
    s = await summary(u)
    raw = int(amount_usdc * 1e6)
    txs = [{"purpose": "approve", "to": s["usdc"], "value": "0x0", "chainId": 8453, "spender": a["spender"],
            "data": "0x095ea7b3" + abi_encode(["address", "uint256"], [a["spender"], raw]).hex()}
           for a in s.get("approvals", []) if a["allowance"] < amount_usdc]
    if REFERRAL_CODE and not u.referred:
        async with core.client() as c:
            cd = await c.account._txb.calldata("/v2/referral/set-code", caller=u.wallet, code=REFERRAL_CODE)
        txs.append({"purpose": "referral", "to": cd.to, "value": cd.value, "chainId": 8453, "data": cd.data})
    return txs


def mark_referred(u: User) -> None:
    u.referred = True
    save(u)


async def prepare_intent(u: User, kind: str) -> dict:
    """EIP-712 payload for the trader to sign; we relay it gaslessly afterwards."""
    if kind not in INTENTS:
        raise UserError(f"{kind} is not available")
    key = Account.create()  # fresh key: becomes the delegate and relays its own registration
    params = {"trader": u.wallet, "delegate": key.address, "expirySeconds": int(time.time()) + DELEGATE_TTL}
    async with AsyncVeranta(network=NETWORK, private_key=key.key.hex()) as c:
        p = await c.account._txb.intent(INTENTS[kind][0], **params)
    _signing[(u.wallet, kind)] = (time.time() + 900, p, key.key.hex())
    return {"domain": p.domain, "types": p.types, "primaryType": p.primary_type, "message": p.message}


async def submit_intent(u: User, kind: str, sig: str) -> str:
    exp, p, key = _signing.pop((u.wallet, kind), (0, None, None))
    if exp < time.time():
        raise UserError("request expired, prepare it again")
    if recover(sig, digest=p.digest) != u.wallet:
        raise UserError(EOA_ONLY)
    data = keccak(text=INTENTS[kind][1])[:4] + abi_encode(["bytes", "bytes"], [to_bytes(hexstr=sig), to_bytes(hexstr=p.encoded_intent)])
    async with AsyncVeranta(network=NETWORK, private_key=key) as c:  # relayed via the key's EIP-7702 account: gasless
        a = c.account
        r = await a._route(CallData.model_validate({
            "to": p.domain["verifyingContract"], "from": a._engine.signer.address, "data": "0x" + data.hex(),
            "value": "0x0", "chainId": await a._engine.chain_id(), "description": kind}), wait=True)
    u.delegate_key, u.delegate_expiry = encrypt(key), int(time.time()) + DELEGATE_TTL - 3600
    save(u)
    journal(u.id, kind, tx=r.tx_hash)
    return r.tx_hash
