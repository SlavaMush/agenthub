"use client";

import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { erc8004IdentityAbi } from "@agenthub/config";
import { contracts, hasContract } from "@/lib/app-config";
import { fetchAgentByAddressOptional } from "@/lib/catalog";
import { fetchAgentProfileFromUri, type AgentProfile } from "@/lib/agentUri";

export function useAgentProfile(address: `0x${string}` | string | undefined) {
  const addr = address?.toLowerCase() as `0x${string}` | undefined;
  const registry = contracts.identityRegistry;
  const registryReady = Boolean(addr && hasContract(registry));

  const catalog = useQuery({
    queryKey: ["agent", addr],
    queryFn: () => fetchAgentByAddressOptional(addr!),
    enabled: Boolean(addr),
    staleTime: 60_000,
    retry: false,
  });

  const tokenId = catalog.data?.identityTokenId ? BigInt(catalog.data.identityTokenId) : undefined;

  const uri = useReadContract({
    address: registry,
    abi: erc8004IdentityAbi,
    functionName: "tokenURI",
    args: tokenId != null ? [tokenId] : undefined,
    query: { enabled: registryReady && tokenId != null && tokenId !== BigInt(0), retry: 1 },
  });

  const profile = useQuery({
    queryKey: ["agent-profile", addr, uri.data],
    queryFn: () => fetchAgentProfileFromUri(uri.data as string),
    enabled: typeof uri.data === "string" && uri.data.length > 0,
    staleTime: 5 * 60_000,
  });

  return {
    tokenId,
    uri: uri.data as string | undefined,
    profile: (profile.data ?? null) as AgentProfile | null,
    catalog: catalog.data,
    isLoading: catalog.isLoading || uri.isLoading || profile.isLoading,
  };
}
