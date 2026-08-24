/** Canonical Base addresses. This is the only place chain ids and USDC/ERC-8004 live. */

export const BASE = {
  chainId: 8453,
  name: "base",
  displayName: "Base",
  rpcUrls: [
    "https://mainnet.base.org",
    "https://base.llamarpc.com",
  ],
  explorer: "https://basescan.org",
  usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  usdcName: "USD Coin",
  usdcVersion: "2",
  identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
  reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
  multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
  x402Network: "base",
};

export const BASE_SEPOLIA = {
  chainId: 84532,
  name: "base-sepolia",
  displayName: "Base Sepolia",
  rpcUrls: [
    "https://sepolia.base.org",
  ],
  explorer: "https://sepolia.basescan.org",
  usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  usdcName: "USD Coin",
  usdcVersion: "2",
  identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
  reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
  multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
  x402Network: "base-sepolia",
};

export const CHAINS = {
  [BASE.chainId]: BASE,
  [BASE_SEPOLIA.chainId]: BASE_SEPOLIA,
  base: BASE,
  "base-sepolia": BASE_SEPOLIA,
};

export function getChain(chainIdOrName) {
  const chain = CHAINS[chainIdOrName];
  if (!chain) {
    throw new Error(`Unknown chain: ${chainIdOrName}. Use 8453 (base) or 84532 (base-sepolia).`);
  }
  return chain;
}

export function isSupportedChain(chainId) {
  return chainId === BASE.chainId || chainId === BASE_SEPOLIA.chainId;
}
