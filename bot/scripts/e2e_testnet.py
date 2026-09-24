"""Testnet end-to-end: fund fresh wallet, register delegate, open/close via platform key.

Run: scripts/run_e2e.sh (or `venv/bin/python scripts/e2e_testnet.py`)

Creates:
  - a fresh TRADER wallet (your "user")
  - a fresh PLATFORM delegate key (our bot's key)
Then: faucet-fund the trader, approve USDC, register delegate, open $10/2x ETH, close.
Prints every tx hash. Keys are written to .env.e2e for later phases.
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import set_key
from eth_account import Account

from veranta_sdk import AsyncVeranta, LocalSigner

ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env.e2e")


def get_or_make(env_name: str) -> str:
    existing = os.environ.get(env_name)
    if existing:
        return existing
    acct = Account.create()
    key = acct.key.hex()
    set_key(ENV_PATH, env_name, key)
    os.environ[env_name] = key
    return key


async def main():
    from dotenv import load_dotenv
    load_dotenv(ENV_PATH)

    trader_key = get_or_make("E2E_TRADER_KEY")
    platform_key = get_or_make("E2E_PLATFORM_DELEGATE_KEY")
    trader_addr = LocalSigner(trader_key).address
    platform_addr = LocalSigner(platform_key).address
    print(f"trader (user):    {trader_addr}")
    print(f"platform delegate: {platform_addr}")

    # Fund the trader wallet on the Veranta testnet fork. The npm SDK's
    # fundTestnetWallet is broken in @0.3.1 (its built-in URL 'devnet-rpc.veranta.xyz'
    # fails its own /testnet/i regex), so we call the fork's dev_impersonateTransaction
    # RPC directly: same mechanism the SDK uses (ETH whale transfer + USDC whale transfer).
    import httpx
    RPC = "https://devnet-rpc.veranta.xyz"
    ETH_WHALE = "0x3304E22DDaa22bCdC5fCa2269b418046aE7b566A"
    USDC_WHALE = "0x6c561B446416E1A00E8E93E221854d6eA4171372"
    USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"

    def rpc(method, params):
        r = httpx.post(RPC, json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params}, timeout=60)
        r.raise_for_status()
        return r.json().get("result")

    def impersonate(from_, to, data="0x", value="0x0"):
        tx = rpc("dev_impersonateTransaction", [{"from": from_, "to": to, "data": data, "value": value}])
        return tx

    # reuse funded keys across runs; only fund if balance is below 100 USDC
    bal = rpc("eth_call", [{"to": USDC, "data": "0x70a08231" + trader_addr[2:].rjust(64, "0")}, "latest"])
    if int(bal, 16) / 1e6 < 100:
        # 0.05 ETH
        tx1 = impersonate(ETH_WHALE, trader_addr, value=hex(int(0.05 * 10**18)))
        print("faucet eth tx:", tx1)
        calldata = "0xa9059cbb" + trader_addr[2:].rjust(64, "0") + hex(100 * 10**6)[2:].rjust(64, "0")
        tx2 = impersonate(USDC_WHALE, USDC, data=calldata)
        print("faucet usdc tx:", tx2)
        rec = rpc("eth_getTransactionReceipt", [tx2])
        if not rec or int(rec["status"], 16) != 1:
            raise SystemExit("USDC impersonation reverted (whale may be drained)")
        bal = rpc("eth_call", [{"to": USDC, "data": "0x70a08231" + trader_addr[2:].rjust(64, "0")}, "latest"])
    usdc = int(bal, 16) / 1e6
    print("usdc balance:", usdc, "USDC")
    if usdc < 100:
        raise SystemExit("faucet funding failed; cannot proceed without test USDC")

    # trader's own client: approve USDC + register our platform key as delegate
    # (relayer mode from the EOA needs an RPC for the EIP-7702 nonce; any Base RPC works)
    async with AsyncVeranta(
        private_key=trader_key, network="testnet", rpc_url="https://mainnet.base.org"
    ) as c:
        print("approving USDC...")
        r = await c.account.approve_usdc()
        print("  approve tx:", getattr(r, "tx_hash", r))
        import time
        expiry = int(time.time()) + 7 * 86400
        print(f"registering delegate {platform_addr} exp {expiry}...")
        r = await c.account.register_delegate(
            delegate=platform_addr, expiry_seconds=expiry, trader_signer=LocalSigner(trader_key)
        )
        print("  register tx:", getattr(r, "tx_hash", r))

    # platform key trades on the trader's account
    async with AsyncVeranta(private_key=platform_key, trader_address=trader_addr, network="testnet") as c:
        print("verifying delegation from platform key side...")
        await c.account.verify_delegation()
        print("  delegation ok")

        print("opening $50 3x ETH long...")
        receipt = await c.trade.market_open("ETH/USD", "long", collateral=50, leverage=3)
        print(f"  FILLED route={receipt.route} tx={receipt.tx_hash} order={receipt.order_id}")

        # positions read can lag the fill by a beat; poll briefly
        import asyncio as _a
        data = None
        for attempt in range(6):
            data = await c.account.positions()
            if data.positions:
                break
            await _a.sleep(2)
        assert data and data.positions, "position never appeared after fill"
        pos = data.positions[0]
        pos_id = (pos.pair_index, pos.index)
        print(f"  position: {pos.side} {float(pos.collateral)} USDC @ {float(pos.open_price)}")

        print("closing...")
        r2 = await c.trade.market_close(pos.pair_index, pos.index, collateral_to_close=float(pos.collateral))
        print(f"  closed tx={r2.tx_hash}")

        # assert OUR position is gone (the reused test wallet may hold strays from earlier runs)
        import asyncio as _a2
        remaining = None
        for _ in range(6):
            d2 = await c.account.positions()
            remaining = {(p.pair_index, p.index) for p in d2.positions}
            if pos_id not in remaining:
                break
            await _a2.sleep(2)
        assert remaining is not None and pos_id not in remaining, f"position {pos_id} still open"
        print(f"FLAT (on our position). {len(remaining)} unrelated positions remain on test wallet.")


if __name__ == "__main__":
    asyncio.run(main())
