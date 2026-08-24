export { BASE, BASE_SEPOLIA, CHAINS, getChain, isSupportedChain } from "./chains.js";
export { usdcAbi, RECEIVE_WITH_AUTHORIZATION_TYPES } from "./abis/usdc.js";
export { erc8004IdentityAbi, isRegistered } from "./abis/erc8004.js";
export { agentHubAbi, memoryMarketAbi, serviceEscrowAbi, JOB_STATUS } from "./abis/marketplace.js";
export { DEPLOYMENTS, getDeployments } from "./deployments.js";

export const X402 = {
  scheme: "exact",
  asset: "USDC",
  extra: { name: "USD Coin", version: "2" },
};

export const DEFAULT_FEES = {
  memoryBps: 1000,
  serviceBps: 500,
};

export function explorerTx(chain, hash) {
  return `${chain.explorer}/tx/${hash}`;
}

export function explorerAddress(chain, address) {
  return `${chain.explorer}/address/${address}`;
}

export function usdcToAtomic(amount) {
  return BigInt(Math.round(Number(amount) * 1e6));
}

export function atomicToUsdc(atomic) {
  return Number(atomic) / 1e6;
}
