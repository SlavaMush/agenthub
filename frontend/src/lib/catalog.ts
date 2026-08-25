import { INDEXER_URL } from "./app-config";

export type MemoryListing = {
  id: number;
  seller: string;
  buyer: string | null;
  priceUSDC: string;
  cid: string;
  cidHash: string;
  uri?: string;
  title?: string;
  brief?: string;
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
  title?: string;
  brief?: string;
  category?: string;
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

export type CatalogQuery = {
  seller?: string;
  buyer?: string;
  status?: string;
  active?: boolean;
  sold?: boolean;
  verified?: boolean;
  limit?: number;
  offset?: number;
};

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${INDEXER_URL}${path}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Indexer ${path} failed (${res.status})`);
  return res.json() as Promise<T>;
}

function queryString(query?: CatalogQuery) {
  if (!query) return "";
  const params = new URLSearchParams();
  if (query.seller) params.set("seller", query.seller);
  if (query.buyer) params.set("buyer", query.buyer);
  if (query.status) params.set("status", query.status);
  if (query.active === true) params.set("active", "true");
  if (query.sold === true) params.set("sold", "true");
  if (query.sold === false) params.set("sold", "false");
  if (query.verified === true) params.set("verified", "true");
  if (query.limit != null) params.set("limit", String(query.limit));
  if (query.offset != null) params.set("offset", String(query.offset));
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export function fetchMemory(query?: CatalogQuery) {
  return getJson<{ modules: MemoryListing[]; total: number }>(`/memory${queryString(query)}`);
}

export function fetchMemoryById(id: string | number) {
  return getJson<MemoryListing>(`/memory/${id}`);
}

export function fetchServices(query?: CatalogQuery) {
  return getJson<{ listings: ServiceListing[]; total: number }>(`/services${queryString(query)}`);
}

export function fetchServiceById(id: string | number) {
  return getJson<ServiceListing>(`/services/${id}`);
}

export function fetchAgents(query?: CatalogQuery) {
  return getJson<{ agents: CatalogAgent[]; total: number }>(`/agents${queryString(query)}`);
}

export function fetchAgentByAddress(address: string) {
  return getJson<CatalogAgent>(`/agents/${address}`);
}

export async function fetchAgentByAddressOptional(address: string) {
  try {
    return await fetchAgentByAddress(address);
  } catch {
    return null;
  }
}

export function fetchStats() {
  return getJson<CatalogStats>("/stats");
}

export function fetchHealth() {
  return getJson<{ status: string; cursor: number; chainId: number | null }>("/health");
}
