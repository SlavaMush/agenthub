"use client";

import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMemory, type MemoryListing } from "@/lib/catalog";
import { contracts, formatUsdc, hasContract, shortAddr } from "@/lib/app-config";
import { useMarketplace } from "@/lib/useMarketplace";

export function MemoryTab() {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["memory"],
    queryFn: fetchMemory,
    refetchInterval: 12_000,
    retry: 1,
  });
  const [filter, setFilter] = useState<"all" | "active" | "sold">("all");
  const market = useMarketplace();
  const [status, setStatus] = useState<string | null>(null);

  const modules = (data?.modules ?? []).filter((m) => {
    if (filter === "active") return m.active && !m.sold;
    if (filter === "sold") return m.sold;
    return true;
  });

  async function onList(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setStatus("Listing…");
    try {
      await market.listMemory(String(form.get("cid") || ""), String(form.get("uri") || ""), String(form.get("price") || "0"));
      setStatus("Listed. The indexer will pick it up on the next sync.");
      e.currentTarget.reset();
      refetch();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "List failed");
    }
  }

  async function onBuy(item: MemoryListing) {
    setStatus(`Buying #${item.id}…`);
    try {
      await market.buyMemory(item.id, item.priceUSDC);
      setStatus("Purchase sent.");
      refetch();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Buy failed");
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">/memory</h1>
          <p className="text-text-muted mt-1">Sibyl Memory modules listed on Base. 10% protocol fee on sale.</p>
        </div>
        <div className="flex items-center gap-2">
          {(["all", "active", "sold"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === f
                  ? "bg-mint/10 border border-mint/30 text-mint"
                  : "bg-bg-elevated border border-border text-text-muted hover:border-mint/50 hover:text-text"
              }`}
            >
              {f === "all" ? "All" : f === "active" ? "For sale" : "Sold"}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-text-muted">Loading catalog…</p>}
      {error && <p className="text-amber-300 text-sm">Catalog unavailable. Start the indexer on :4001.</p>}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((module) => (
          <article key={module.id} className={`bg-bg-elevated border border-border rounded-2xl p-6 ${module.sold ? "opacity-60" : ""}`}>
            <div className="flex items-center justify-between mb-4">
              <span className="px-3 py-1 rounded-full text-xs font-medium border border-mint/30 text-mint">MEMORY</span>
              <span className="text-xs text-text-muted font-mono">#{module.id}</span>
            </div>
            <h3 className="text-lg font-semibold mb-2 truncate">{module.cid}</h3>
            <p className="text-text-muted text-sm mb-4 font-mono break-all">{module.cidHash}</p>
            <div className="space-y-2 mb-4 text-sm text-text-muted">
              <div>Seller {shortAddr(module.seller)}</div>
              {module.buyer && <div>Buyer {shortAddr(module.buyer)}</div>}
            </div>
            <div className="border-t border-border pt-4 flex items-center justify-between">
              <div>
                <span className="text-text-muted text-xs">Price</span>
                <div className="font-mono text-xl font-semibold text-mint">
                  {module.sold ? "SOLD" : `${formatUsdc(module.priceUSDC)} USDC`}
                </div>
              </div>
              <button
                disabled={module.sold || !module.active || !market.isConnected || market.isPending}
                onClick={() => onBuy(module)}
                className={`px-5 py-2.5 rounded-xl font-medium transition-all ${
                  module.sold || !module.active ? "bg-border text-text-muted cursor-not-allowed" : "bg-gradient-mint text-bg hover:opacity-90"
                }`}
              >
                {module.sold ? "Sold" : "Buy Now"}
              </button>
            </div>
          </article>
        ))}
      </div>

      {!isLoading && modules.length === 0 && (
        <div className="text-center py-16 text-text-muted">No memory listings indexed yet.</div>
      )}

      <form onSubmit={onList} className="border border-mint/30 rounded-2xl p-8 bg-mint/5 space-y-4">
        <h3 className="text-xl font-semibold">List a memory module</h3>
        <p className="text-text-muted text-sm">Requires an ERC-8004 identity on this wallet. Price is Circle USDC.</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <input name="cid" required placeholder="CID" className="px-4 py-2.5 rounded-xl bg-bg-elevated border border-border" />
          <input name="uri" placeholder="ipfs://… token URI" className="px-4 py-2.5 rounded-xl bg-bg-elevated border border-border" />
          <input name="price" required placeholder="Price USDC" className="px-4 py-2.5 rounded-xl bg-bg-elevated border border-border" />
        </div>
        <button
          disabled={!market.isConnected || market.isPending || !hasContract(contracts.memoryMarket)}
          className="px-6 py-3 rounded-xl bg-gradient-mint text-bg font-medium hover:opacity-90 disabled:opacity-40"
        >
          List module
        </button>
        {status && <p className="text-sm text-text-muted">{status}</p>}
      </form>
    </div>
  );
}
