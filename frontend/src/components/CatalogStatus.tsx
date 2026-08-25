"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchHealth, fetchStats } from "@/lib/catalog";
import { chain, contracts, formatUsdc, hasContract } from "@/lib/app-config";

export function CatalogStatus() {
  const health = useQuery({ queryKey: ["health"], queryFn: fetchHealth, refetchInterval: 15_000, retry: 1 });
  const stats = useQuery({ queryKey: ["stats"], queryFn: fetchStats, refetchInterval: 15_000, retry: 1 });
  const deployed = hasContract(contracts.memoryMarket) && hasContract(contracts.serviceEscrow);

  const tiles = [
    { label: "Volume", value: stats.data ? `${formatUsdc(stats.data.volumeUSDC)} USDC` : "—" },
    { label: "Memory", value: stats.data ? String(stats.data.memory) : "—" },
    { label: "Services", value: stats.data ? String(stats.data.services) : "—" },
    { label: "Agents", value: stats.data ? String(stats.data.agents) : "—" },
  ];

  return (
    <section className="mb-10">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <span
          className={`inline-flex items-center gap-2 h-8 px-3 rounded-full text-xs font-medium border ${
            health.isSuccess ? "border-mint/25 bg-mint/10 text-mint" : "border-amber-500/30 bg-amber-500/10 text-amber-200"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${health.isSuccess ? "bg-mint" : "bg-amber-300"}`} />
          {health.isSuccess ? "Indexer live" : "Indexer offline"}
        </span>
        <span className="text-xs text-text-muted">{chain.displayName}</span>
        {health.data?.cursor != null && (
          <span className="font-mono text-[11px] text-text-muted/80">block {health.data.cursor}</span>
        )}
        {!deployed && (
          <span className="text-xs text-text-muted">Markets undeployed — browsing is live, settlement waits for forge script.</span>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-4">
            <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted mb-1">{tile.label}</div>
            <div className="font-mono text-lg text-mint">{tile.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
