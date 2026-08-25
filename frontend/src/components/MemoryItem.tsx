"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchMemoryById } from "@/lib/catalog";
import { listingTitle, timeAgo, txUrl } from "@/lib/app-config";
import { sameAddr } from "@/lib/format";
import { memoryFeeHint } from "@/lib/jobUi";
import { useMarketplace } from "@/lib/useMarketplace";
import { useToast } from "@/components/Toast";
import { PayButton, UsdcBalance } from "@/components/ConnectToAct";
import { AgentName } from "@/components/AgentName";
import { StoryRail } from "@/components/StoryRail";
import { Badge, Button, CopyButton, Identicon, Notice, Price } from "@/components/ui";

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
  const shareUrl = typeof window !== "undefined" ? window.location.href : `/memory/${detail.id}`;

  return (
    <article className="max-w-xl space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-mint mb-2">Token #{detail.id}</p>
        <h1 className="font-display text-3xl tracking-tight mb-2">{title}</h1>
        <p className="text-sm text-text-muted">Sibyl Memory as an ERC-721. The CID is the payload you import after purchase.</p>
      </div>

      <ol className="grid grid-cols-2 gap-1">
        <li className={`rounded-lg border px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide ${!detail.sold ? "border-mint/40 bg-mint/10 text-mint" : "border-white/10 text-text-muted"}`}>
          Listed
        </li>
        <li className={`rounded-lg border px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide ${detail.sold ? "border-mint/40 bg-mint/10 text-mint" : "border-white/10 text-text-muted"}`}>
          {detail.sold ? "Sold" : "For sale"}
        </li>
      </ol>

      <div className="flex items-center justify-between">
        <Badge status={detail.sold ? "sold" : "Listed"} />
        {detail.sold ? <span className="font-mono text-2xl text-text-muted">Sold</span> : <Price atomic={detail.priceUSDC} size="xl" />}
      </div>
      {!detail.sold && <p className="text-sm text-text-muted">{memoryFeeHint(detail.priceUSDC)}</p>}

      <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
        <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted mb-2">CID</p>
        <p className="font-mono text-xs break-all">{detail.cid}</p>
        <div className="mt-2">
          <CopyButton value={detail.cid} label="Copy CID" />
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <Identicon address={detail.seller} size={28} />
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Seller</p>
          <AgentName address={detail.seller} />
        </div>
      </div>
      {detail.listedAt ? <p className="text-xs text-text-muted">Listed {timeAgo(detail.listedAt)}</p> : null}

      {isBuyer && (
        <div className="rounded-2xl border border-mint/25 bg-mint/10 p-4 space-y-2">
          <p className="font-medium text-mint">You own this NFT</p>
          <p className="text-sm text-text-muted leading-relaxed">
            Token #{detail.id} is in this wallet. Copy the CID and import it into Sibyl. The chain stores the pointer, not the bytes.
          </p>
          <CopyButton value={detail.cid} label="Copy CID to import" />
        </div>
      )}

      {!detail.sold && detail.active && isSeller && (
        <Button variant="ghost" className="w-full" disabled={market.isPending} onClick={() => run(`Memory #${detail.id} delisted.`, () => market.delistMemory(detail.id))}>
          Delist
        </Button>
      )}
      {!detail.sold && detail.active && !isSeller && (
        <>
          <UsdcBalance className="block text-center" />
          <PayButton
            className="w-full"
            connected={market.isConnected}
            pending={market.isPending}
            disconnectedLabel="Connect to buy"
            onClick={() => run(`Memory #${detail.id} purchased.`, () => market.buyMemory(detail.id, detail.priceUSDC))}
          >
            Buy with USDC
          </PayButton>
        </>
      )}

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/8">
        <CopyButton value={shareUrl} label="Copy module link" />
        <Link href="/guide#story-buy-memory" className="text-xs text-text-muted hover:text-mint">
          Buy-memory story
        </Link>
      </div>

      <StoryRail
        kicker="Next in this story"
        items={[
          { href: "/guide#story-buy-memory", title: "Buy" },
          { href: "/guide#story-sell-memory", title: "Sell" },
          { href: "/guide#story-delist", title: "Delist" },
          { href: `/agents/${detail.seller}`, title: "Seller shop" },
        ]}
      />
    </article>
  );
}
