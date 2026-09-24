"""On-chain signature pre-verification for delegate registration.

Per Base/Coinbase docs: Smart Wallet counterfactual signatures are wrapped in
ERC-6492 (deploy + verify atomic). Best-practice is to verify via the
ERC-6492 Universal Validator so we catch bad signatures off-chain instead of
relaying a doomed tx.

We call the UniversalSigValidator via eth_call.
"""
import logging
from eth_abi import encode as abi_encode, decode
from eth_utils import keccak, to_bytes

log = logging.getLogger("veranta-bot.sigverify")

# ERC-6492 Universal Validator singleton address (same on Base).
UNIVERSAL_SIG_VALIDATOR = "0x649264926492649264926492649264926492649c"

# function isValidUniversalSig(address _signer, bytes32 _hash, bytes _signature)
_IS_VALID_UNIVERSAL_SIG_SELECTOR = keccak(text="isValidUniversalSig(address,bytes32,bytes)")[:4]

# function isValidSigWithSideEffects(address _signer, bytes32 _hash, bytes _signature)
# — this one DEPLOYS the counterfactual wallet AND verifies in one tx.
_IS_VALID_WITH_SIDE_EFFECTS_SELECTOR = keccak(text="isValidSigWithSideEffects(address,bytes32,bytes)")[:4]


def _build_is_valid_universal_sig_call(signer: str, digest_bytes: bytes, signature: bytes) -> tuple[str, str]:
    """Return (to, calldata_hex)"""
    args = abi_encode(
        ["address", "bytes32", "bytes"],
        [to_bytes(hexstr=signer), digest_bytes, signature],
    )
    return (UNIVERSAL_SIG_VALIDATOR, "0x" + (_IS_VALID_UNIVERSAL_SIG_SELECTOR + args).hex())


def _build_is_valid_with_side_effects_call(signer: str, digest_bytes: bytes, signature: bytes) -> tuple[str, str]:
    args = abi_encode(
        ["address", "bytes32", "bytes"],
        [to_bytes(hexstr=signer), digest_bytes, signature],
    )
    return (UNIVERSAL_SIG_VALIDATOR, "0x" + (_IS_VALID_WITH_SIDE_EFFECTS_SELECTOR + args).hex())


async def verify_signature(
    *,
    rpc_url: str,
    signer: str,
    digest_bytes: bytes,
    signature_hex: str,
) -> tuple[bool, str]:
    """Returns (is_valid, reason). Prefers isValidUniversalSig; if the wrapped
    sig requires counterfactual deployment, falls back to isValidSigWithSideEffects.
    """
    import httpx

    signature = to_bytes(hexstr=signature_hex)

    # First: isValidUniversalSig — read-only check.
    to, data = _build_is_valid_universal_sig_call(signer, digest_bytes, signature)
    payload = {
        "jsonrpc": "2.0", "id": 1, "method": "eth_call",
        "params": [{"to": to, "data": data}, "latest"],
    }
    try:
        r = httpx.post(rpc_url, json=payload, timeout=10)
        resp = r.json()
        if "result" in resp and resp["result"] != "0x":
            decoded = decode(["bool"], to_bytes(hexstr=resp["result"]))[0]
            return bool(decoded), "" if decoded else "isValidUniversalSig returned false"
    except Exception as e:
        log.warning("isValidUniversalSig call failed: %s", e)

    # Fallback: isValidSigWithSideEffects (counterfactual deploy + verify).
    to, data = _build_is_valid_with_side_effects_call(signer, digest_bytes, signature)
    payload["params"][0]["data"] = data
    try:
        r = httpx.post(rpc_url, json=payload, timeout=15)
        resp = r.json()
        if "result" in resp and resp["result"] != "0x":
            decoded = decode(["bool"], to_bytes(hexstr=resp["result"]))[0]
            return bool(decoded), "" if decoded else "isValidSigWithSideEffects returned false"
        err = resp.get("error", {})
        return False, f"sig verify reverted: {err.get('message', 'unknown')[:200]}"
    except Exception as e:
        return False, f"sig verify rpc error: {e}"
