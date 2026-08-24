import { INDEXER_URL } from "./app-config";

export type MemoryListing = {
  id: number;
  seller: string;
  buyer: string | null;
  priceUSDC: string;
  cid: string;
  cidHash: string;
  active: boolean;
  sold: boolean;
  listedAt: number;
  soldAt: number | null;
  feeUSDC?: string;
};

export type ServiceListing = {
  id: number;
  seller: string;
  buyer: string | null;
  priceUSDC: string;
  deadline: number;
  uri: string;
  cid: string;
  status: string;
  listedAt: number;
};

export type CatalogAgent = {
  address: string;
  memoryListed: number;
  memorySold: number;
  servicesListed: number;
  servicesCompleted: number;
  volumeUSDC: string;
  registeredAt: number;
  identityTokenId: string | null;
  verified: boolean;
};

export type CatalogStats = {
  volume: number;
  fees: number;
  memory: number;
  services: number;
  agents: number;
  volumeUSDC: string;
  feesUSDC: string;
  paused: boolean;
};

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${INDEXER_URL}${path}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Indexer ${path} failed (${res.status})`);
  return res.json() as Promise<T>;
}

export function fetchMemory() {
  return getJson<{ modules: MemoryListing[]; total: number }>("/memory");
}

export function fetchServices() {
  return getJson<{ listings: ServiceListing[]; total: number }>("/services");
}

export function fetchAgents() {
  return getJson<{ agents: CatalogAgent[]; total: number }>("/agents");
}

export function fetchStats() {
  return getJson<CatalogStats>("/stats");
}

export function fetchHealth() {
  return getJson<{ status: string; cursor: number; chainId: number | null }>("/health");
}
