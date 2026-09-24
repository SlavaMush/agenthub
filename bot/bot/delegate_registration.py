"""Unified delegate-registration flow.

Single implementation used by both the Telegram `/connect` path and the web
`/start` path. Per-user delegate keys are generated per-account (Bankr-style):
each user signs an EIP-712 DelegateReq authorizing THEIR OWN delegate key to
trade on their behalf. We relay the setDelegateWithSig transaction via the
relayer network using the delegate key itself as the signer.

Why not SDK's `account.register_delegate(...)`: it requires a local
`trader_signer` capable of signing typed data — but in our design the trader
signs in a browser session on a different machine. So we build the intent,
hand the typed data to the wallet, receive the raw signature, and manually
construct the setDelegateWithSig calldata like the SDK does.

This module retains the intent-builder + calldata-construction logic but NOT
crypto storage (see `connect.py`) or policy persistence (see `onboard.py`).
"""
import logging
import time
from dataclasses import dataclass
from typing import Optional

from eth_abi import encode as abi_encode
from eth_utils import keccak, to_bytes

log = logging.getLogger("veranta-bot.delegate_registration")

_DELEGATE_SET_INTENT_PATH = "/v2/intents/delegate-set"
_SET_DELEGATE_WITH_SIG_SELECTOR = keccak(text="setDelegateWithSig(bytes,bytes)")[:4]


@dataclass
class DelegateRegistrationResult:
    tx_hash: str
    delegate_address: str
    expiry_timestamp: int
    encoded_intent: str


async def build_delegate_typed_data(
    *,
    trader: str,
    delegate: str,
    expiry_timestamp: int,
    relayer_private_key: str,
    network: str,
) -> dict:
    """Build the EIP-712 DelegateReq payload the trader must sign.

    Returns a dict ready to send to the wallet.
    """
    from veranta_sdk import AsyncVeranta

    async with AsyncVeranta(private_key=relayer_private_key, network=network) as c:
        payload = await c.account._txb.intent(
            _DELEGATE_SET_INTENT_PATH,
            trader=trader,
            delegate=delegate,
            expirySeconds=expiry_timestamp,
        )
        return {
            "typedData": {
                "domain": payload.domain,
                "types": payload.types,
                "primaryType": payload.primary_type,
                "message": payload.message,
            },
            "digest": payload.digest,
            "encodedIntent": payload.encoded_intent,
            "expirySeconds": expiry_timestamp,
            "delegate": delegate,
        }


async def submit_delegate_registration(
    *,
    trader: str,
    delegate: str,
    expiry_timestamp: int,
    signature: str,
    encoded_intent: str,
    relayer_private_key: str,
    network: str,
) -> DelegateRegistrationResult:
    """Submit the trader's signed delegate registration via the relayer network.

    The relayer is the delegate key itself (so its address hits msg.sender on the
    Router, and Router.registerDelegate allows passthrough when signer ==
    the delegate address being registered).
    """
    from veranta_sdk import AsyncVeranta
    from veranta_sdk.types import CallData

    data_no_sel = abi_encode(
        ["bytes", "bytes"],
        [to_bytes(hexstr=signature), to_bytes(hexstr=encoded_intent)],
    )
    full_calldata = "0x" + (_SET_DELEGATE_WITH_SIG_SELECTOR + data_no_sel).hex()

    async with AsyncVeranta(private_key=relayer_private_key, network=network) as c:
        acc = c.account
        meta = await acc._get_meta()
        router = meta["addresses"]["tradingRouter"]
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
        return DelegateRegistrationResult(
            tx_hash=getattr(receipt, "tx_hash", str(receipt)),
            delegate_address=delegate,
            expiry_timestamp=expiry_timestamp,
            encoded_intent=encoded_intent,
        )


def new_delegate_key_and_address() -> tuple[str, str]:
    """Generate a fresh per-user delegate keypair."""
    from eth_account import Account
    acct = Account.create()
    return acct.key.hex(), acct.address


def default_expiry(days: int = 30) -> int:
    return int(time.time()) + days * 86400
