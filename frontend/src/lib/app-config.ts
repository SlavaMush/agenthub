import { getChain, getDeployments, atomicToUsdc, usdcToAtomic } from "@agenthub/config";

export const APP_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 84532);
export const INDEXER_URL = process.env.NEXT_PUBLIC_INDEXER_URL || "http://localhost:4001";

export const chain = getChain(APP_CHAIN_ID);
const deployed = getDeployments(APP_CHAIN_ID);

function addr(value: unknown): `0x${string}` | undefined {
  const s = String(value || "");
  return /^0x[0-9a-fA-F]{40}$/.test(s) ? (s as `0x${string}`) : undefined;
}

export const contracts = {
  agentHub: addr(process.env.NEXT_PUBLIC_AGENT_HUB_ADDRESS || deployed.agentHub),
  memoryMarket: addr(process.env.NEXT_PUBLIC_MEMORY_MARKET_ADDRESS || deployed.memoryMarket),
  serviceEscrow: addr(process.env.NEXT_PUBLIC_SERVICE_ESCROW_ADDRESS || deployed.serviceEscrow),
  identityRegistry: addr(process.env.NEXT_PUBLIC_IDENTITY_REGISTRY || chain.identityRegistry),
  usdc: addr(chain.usdc)!,
};

export function hasContract(value?: string) {
  return Boolean(value && /^0x[0-9a-fA-F]{40}$/.test(value));
}

export function formatUsdc(atomic: string | number | bigint) {
  const n = atomicToUsdc(atomic);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function parseUsdcInput(value: string) {
  return usdcToAtomic(value);
}

export function shortAddr(value: string) {
  if (!value) return "";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}
