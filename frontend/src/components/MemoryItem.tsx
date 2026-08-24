"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchMemoryById } from "@/lib/catalog";
import { addressUrl, listingTitle, shortAddr, txUrl } from "@/lib/app-config";
import { sameAddr } from "@/lib/format";
import { useMarketplace } from "@/lib/useMarketplace";
import { useToast } from "@/components/Toast";
import { PayButton, UsdcBalance } from "@/components/ConnectToAct";
import { Badge, Button, Notice, Price } from "@/components/ui";

export function MemoryItem({ id }: { id: string }) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["memory-item", id],
    queryFn: () => fetchMemoryById(id),
    refetchInterval: 12_000,
  });
  const market = useMarketplace();
  const toast = useToast();

  async function run(title: string, fn: () => Promise<`0x${string}`>) {
    try {
      const hash = await fn();
      toast.push({ tone: "ok", title, href: txUrl(hash) });
      refetch();
    } catch (err) {
      toast.push({ tone: "warn", title: err instanceof Error ? err.message : "Transaction failed" });
    }
  }

  if (isLoading) return <p className="text-text-muted">Loading module…</p>;
  if (error || !data) return <Notice tone="warn">Module not found in the catalog.</Notice>;

  const detail = data;
  const title = detail.title || listingTitle(detail.uri || detail.cid);
  const isSeller = sameAddr(market.address, detail.seller);
  const isBuyer = sameAddr(market.address, detail.buyer);

  return (
    <article className="max-w-xl space-y-5">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-mint mb-2">Token #{detail.id}</p>
        <h1 className="font-display text-3xl tracking-tight mb-2">{title}</h1>
      </div>
      <div className="flex items-center justify-between">
        <Badge status={detail.sold ? "sold" : "Listed"} />
        {detail.sold ? <span className="font-mono text-2xl text-text-muted">Sold</span> : <Price atomic={detail.priceUSDC} size="xl" />}
      </div>
      <div className="rounded-2xl border border-white/8 bg-black/20 p-3 font-mono text-xs break-all">
        {detail.cid}
      </div>
      <a href={addressUrl(detail.seller)} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm hover:text-mint font-mono">
        Seller {shortAddr(detail.seller)}
      </a>
      {isBuyer && <p className="text-sm text-mint">You own this NFT. Resolve the CID in your own stack.</p>}
      {!detail.sold && detail.active && isSeller && (
        <Button variant="ghost" className="w-full" disabled={market.isPending} onClick={() => run(`Memory #${detail.id} delisted.`, () => market.delistMemory(detail.id))}>
          Delist
        </Button>
      )}
      {!detail.sold && detail.active && !isSeller && (
        <>
          <UsdcBalance className="block text-center" />
          <PayButton className="w-full" connected={market.isConnected} pending={market.isPending} disconnectedLabel="Connect to buy" onClick={() => run(`Memory #${detail.id} purchased.`, () => market.buyMemory(detail.id, detail.priceUSDC))}>
            Buy with USDC
          </PayButton>
        </>
      )}
    </article>
  );
}
