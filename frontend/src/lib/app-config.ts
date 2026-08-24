import { getChain, getDeployments, atomicToUsdc, usdcToAtomic, explorerAddress, explorerTx } from "@agenthub/config";
import { parseListingUri } from "./uris";

export const APP_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 84532);
export const INDEXER_URL =
  process.env.NEXT_PUBLIC_INDEXER_URL ||
  (typeof window === "undefined" ? "http://127.0.0.1:4001" : "/catalog");

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
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function parseUsdcInput(value: string) {
  return usdcToAtomic(value);
}

export function shortAddr(value: string) {
  if (!value) return "";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function addressUrl(value: string) {
  return explorerAddress(chain, value);
}

export function txUrl(hash: string) {
  return explorerTx(chain, hash);
}

export function timeAgo(ts: number) {
  if (!ts) return "";
  const ms = ts > 1e12 ? Date.now() - ts : Date.now() - ts * 1000;
  const min = Math.max(0, Math.floor(ms / 60000));
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export function listingTitle(uriOrCid: string, storedTitle = "") {
  if (storedTitle.trim()) return storedTitle.trim();
  const parsed = parseListingUri(uriOrCid);
  if (parsed.title) return parsed.title;
  if (!uriOrCid) return "Untitled";
  try {
    const url = new URL(uriOrCid);
    if (url.protocol === "agenthub:") return "Untitled listing";
    if (url.protocol === "ipfs:") {
      const cid = (url.hostname || url.pathname.replace(/^\//, "")).split("?")[0];
      if (cid.length > 22) return `${cid.slice(0, 10)}…${cid.slice(-6)}`;
      return cid || "ipfs";
    }
    if (url.protocol === "data:") return "Embedded profile";
    return url.hostname || uriOrCid;
  } catch {
    if (uriOrCid.length > 42) return `${uriOrCid.slice(0, 18)}…${uriOrCid.slice(-8)}`;
    return uriOrCid;
  }
}
