"use client";

import { FormEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAgents } from "@/lib/catalog";
import { formatUsdc, shortAddr } from "@/lib/app-config";
import { useMarketplace } from "@/lib/useMarketplace";

export function AgentsTab() {
  const { data, error, isLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: fetchAgents,
    refetchInterval: 12_000,
    retry: 1,
  });
  const [search, setSearch] = useState("");
  const market = useMarketplace();
  const [status, setStatus] = useState<string | null>(null);

  const agents = useMemo(() => {
    const q = search.toLowerCase();
    return (data?.agents ?? []).filter(
      (a) => a.address.includes(q) || String(a.identityTokenId || "").includes(q),
    );
  }, [data, search]);

  async function onRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setStatus("Registering…");
    try {
      await market.registerAgent(String(form.get("uri") || "https://agenthub.base/agent"));
      setStatus("Identity mint submitted.");
      e.currentTarget.reset();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Register failed");
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">/agents</h1>
          <p className="text-text-muted mt-1">ERC-8004 identity directory plus marketplace volume from the indexer.</p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search address or token id"
          className="px-4 py-2.5 rounded-xl bg-bg-elevated border border-border text-text placeholder-text-muted focus:border-mint/50 focus:outline-none"
        />
      </div>

      {isLoading && <p className="text-text-muted">Loading catalog…</p>}
      {error && <p className="text-amber-300 text-sm">Catalog unavailable. Start the indexer on :4001.</p>}

      <div className="space-y-4">
        {agents.map((agent) => (
          <article key={agent.address} className="bg-bg-elevated border border-border rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold font-mono">{shortAddr(agent.address)}</h3>
                  {agent.verified && (
                    <span className="px-2 py-0.5 rounded-full bg-mint/10 text-mint text-xs font-medium">Verified</span>
                  )}
                </div>
                <p className="text-text-muted text-sm mt-1 font-mono break-all">{agent.address}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold font-mono text-mint">{formatUsdc(agent.volumeUSDC)} USDC</div>
                <div className="text-xs text-text-muted">Lifetime volume</div>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 mt-4 border-t border-border text-sm">
              <Metric label="Memory listed" value={String(agent.memoryListed)} />
              <Metric label="Memory sold" value={String(agent.memorySold)} />
              <Metric label="Services listed" value={String(agent.servicesListed)} />
              <Metric label="Services done" value={String(agent.servicesCompleted)} />
            </div>
            {agent.identityTokenId && (
              <p className="text-xs text-text-muted mt-3">Identity token #{agent.identityTokenId}</p>
            )}
          </article>
        ))}
      </div>

      {!isLoading && agents.length === 0 && (
        <div className="text-center py-16 text-text-muted">No agents indexed yet. Register below, then list.</div>
      )}

      <form onSubmit={onRegister} className="border border-mint/30 rounded-2xl p-8 bg-mint/5 space-y-4">
        <h3 className="text-xl font-semibold">Register ERC-8004 identity</h3>
        <p className="text-text-muted text-sm">Mints an identity NFT on Base. Required before listing memory or services.</p>
        <input
          name="uri"
          defaultValue="https://agenthub.base/agent"
          className="w-full px-4 py-2.5 rounded-xl bg-bg-elevated border border-border"
        />
        <button
          disabled={!market.isConnected || market.isPending}
          className="px-6 py-3 rounded-xl bg-gradient-mint text-bg font-medium hover:opacity-90 disabled:opacity-40"
        >
          Register agent
        </button>
        {status && <p className="text-sm text-text-muted">{status}</p>}
      </form>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-text-muted">{label}</div>
      <div className="font-mono font-semibold text-mint">{value}</div>
    </div>
  );
}
