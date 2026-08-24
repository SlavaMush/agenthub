# AgentHub contracts (v1 settlement)

Three contracts, USDC on Base, ERC-8004 identity gate.

| Contract | Role |
|---|---|
| `AgentHub` | Pause, fees, treasury, ERC-8004 registry, USDC. Does not hold funds. |
| `MemoryMarket` | Thin ERC-721. List CID + `tokenURI`. Buy with `transferFrom` or EIP-3009 `receiveWithAuthorization`. |
| `ServiceEscrow` | Fund → deliver → confirm. Timeout refund, 3-day auto-release, owner resolve after freeze. |

Old marketplace contracts live in `legacy/` (not compiled).

## Addresses (`packages/config`)

| | Base `8453` | Base Sepolia `84532` |
|---|---|---|
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| ERC-8004 Identity | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |

## Test

```bash
cd contracts
forge test
```

## Deploy

```bash
# Base Sepolia
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $BASE_SEPOLIA_RPC \
  --broadcast --verify --chain 84532

# Base mainnet
forge script script/Deploy.s.sol:Deploy \
  --rpc-url $BASE_MAINNET_RPC \
  --broadcast --verify --chain 8453
```

Optional env: `TREASURY` (defaults to the deployer).
