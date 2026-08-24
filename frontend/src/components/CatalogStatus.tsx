"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchHealth, fetchStats } from "@/lib/catalog";
import { INDEXER_URL, chain, contracts, hasContract } from "@/lib/app-config";

export function CatalogStatus() {
  const health = useQuery({ queryKey: ["health"], queryFn: fetchHealth, refetchInterval: 15_000, retry: 1 });
  const stats = useQuery({ queryKey: ["stats"], queryFn: fetchStats, refetchInterval: 15_000, retry: 1 });
  const deployed = hasContract(contracts.memoryMarket) && hasContract(contracts.serviceEscrow);

  return (
    <div className="mb-8 flex flex-wrap items-center gap-3 text-xs">
      <span
        className={`px-3 py-1 rounded-full border ${
          health.isSuccess ? "border-mint/30 text-mint bg-mint/10" : "border-amber-500/30 text-amber-300 bg-amber-500/10"
        }`}
      >
        {health.isSuccess ? `Indexer live · cursor ${health.data.cursor}` : `Indexer offline · ${INDEXER_URL}`}
      </span>
      <span className="text-text-muted">{chain.displayName}</span>
      {stats.data && (
        <span className="text-text-muted">
          {stats.data.memory} memory · {stats.data.services} services · {stats.data.agents} agents
        </span>
      )}
      {!deployed && (
        <span className="px-3 py-1 rounded-full border border-border text-text-muted">
          Markets not deployed yet — browse works, writes wait for forge script
        </span>
      )}
    </div>
  );
}
