"use client";

import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchServices, type ServiceListing } from "@/lib/catalog";
import { contracts, formatUsdc, hasContract, shortAddr } from "@/lib/app-config";
import { useMarketplace } from "@/lib/useMarketplace";

export function ServicesTab() {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["services"],
    queryFn: fetchServices,
    refetchInterval: 12_000,
    retry: 1,
  });
  const [filter, setFilter] = useState("all");
  const market = useMarketplace();
  const [status, setStatus] = useState<string | null>(null);

  const listings = (data?.listings ?? []).filter((s) => (filter === "all" ? true : s.status === filter));

  async function onList(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setStatus("Listing…");
    try {
      await market.listService(String(form.get("uri") || ""), String(form.get("price") || "0"), String(form.get("hours") || "24"));
      setStatus("Listed. The indexer will pick it up on the next sync.");
      e.currentTarget.reset();
      refetch();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "List failed");
    }
  }

  async function onFund(item: ServiceListing) {
    setStatus(`Funding job #${item.id}…`);
    try {
      await market.fundService(item.id, item.priceUSDC);
      setStatus("Escrow funded.");
      refetch();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Fund failed");
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">/services</h1>
          <p className="text-text-muted mt-1">Hire verified agents. Funds sit in escrow until delivery or timeout.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {["all", "Listed", "Funded", "Delivered", "Completed"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === f
                  ? "bg-mint/10 border border-mint/30 text-mint"
                  : "bg-bg-elevated border border-border text-text-muted hover:border-mint/50 hover:text-text"
              }`}
            >
              {f === "all" ? "All" : f}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-text-muted">Loading catalog…</p>}
      {error && <p className="text-amber-300 text-sm">Catalog unavailable. Start the indexer on :4001.</p>}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((service) => (
          <article key={service.id} className="bg-bg-elevated border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="px-3 py-1 rounded-full text-xs font-medium border border-mint/30 text-mint">{service.status}</span>
              <span className="text-xs text-text-muted font-mono">#{service.id}</span>
            </div>
            <h3 className="text-lg font-semibold mb-2 break-all">{service.uri}</h3>
            <div className="space-y-2 mb-4 text-sm text-text-muted">
              <div>Seller {shortAddr(service.seller)}</div>
              {service.buyer && <div>Buyer {shortAddr(service.buyer)}</div>}
              <div>Deadline {service.deadline ? new Date(service.deadline * 1000).toLocaleString() : "—"}</div>
            </div>
            <div className="border-t border-border pt-4 flex items-center justify-between">
              <div>
                <span className="text-text-muted text-xs">Price</span>
                <div className="font-mono text-xl font-semibold text-mint">{formatUsdc(service.priceUSDC)} USDC</div>
              </div>
              <button
                disabled={service.status !== "Listed" || !market.isConnected || market.isPending}
                onClick={() => onFund(service)}
                className="px-5 py-2.5 rounded-xl font-medium bg-gradient-mint text-bg hover:opacity-90 disabled:opacity-40"
              >
                Fund escrow
              </button>
            </div>
          </article>
        ))}
      </div>

      {!isLoading && listings.length === 0 && (
        <div className="text-center py-16 text-text-muted">No services indexed yet.</div>
      )}

      <form onSubmit={onList} className="border border-mint/30 rounded-2xl p-8 bg-mint/5 space-y-4">
        <h3 className="text-xl font-semibold">List a service</h3>
        <p className="text-text-muted text-sm">Duration must be between 1 hour and 30 days. 5% protocol fee on completion.</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <input name="uri" required placeholder="ipfs:// or https:// brief" className="px-4 py-2.5 rounded-xl bg-bg-elevated border border-border" />
          <input name="price" required placeholder="Price USDC" className="px-4 py-2.5 rounded-xl bg-bg-elevated border border-border" />
          <input name="hours" defaultValue="24" placeholder="Duration hours" className="px-4 py-2.5 rounded-xl bg-bg-elevated border border-border" />
        </div>
        <button
          disabled={!market.isConnected || market.isPending || !hasContract(contracts.serviceEscrow)}
          className="px-6 py-3 rounded-xl bg-gradient-mint text-bg font-medium hover:opacity-90 disabled:opacity-40"
        >
          List service
        </button>
        {status && <p className="text-sm text-text-muted">{status}</p>}
      </form>
    </div>
  );
}
