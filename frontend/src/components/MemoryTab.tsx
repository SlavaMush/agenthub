"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchMemory } from "@/lib/catalog";
import { contracts, hasContract, listingTitle, timeAgo, txUrl } from "@/lib/app-config";
import { matchesQuery, sortListings } from "@/lib/format";
import { useMarketplace } from "@/lib/useMarketplace";
import { useToast } from "@/components/Toast";
import { HowItWorks } from "@/components/HowItWorks";
import { ConnectToAct } from "@/components/ConnectToAct";
import { IdentityGate } from "@/components/IdentityGate";
import { AgentName } from "@/components/AgentName";
import { StoryRail } from "@/components/StoryRail";
import { buildMemoryUri } from "@/lib/uris";
import {
  Badge,
  Button,
  ChipRow,
  CopyButton,
  EmptyState,
  Field,
  Identicon,
  MarketHeader,
  Modal,
  Notice,
  Price,
  SkeletonGrid,
  inputClass,
} from "@/components/ui";

const filters = [
  { id: "active", label: "For sale" },
  { id: "sold", label: "Sold" },
  { id: "all", label: "All" },
];

export function MemoryTab() {
  const params = useSearchParams();
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["memory"],
    queryFn: () => fetchMemory(),
    refetchInterval: 12_000,
    retry: 1,
  });
  const market = useMarketplace();
  const toast = useToast();
  const [filter, setFilter] = useState("active");
  const [sort, setSort] = useState<"new" | "price-asc" | "price-desc">("new");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (params.get("list") === "1") setOpen(true);
  }, [params]);

  const modules = useMemo(() => {
    const source = data?.modules ?? [];
    const filtered = source.filter((item) => {
      if (filter === "active" && (!item.active || item.sold)) return false;
      if (filter === "sold" && !item.sold) return false;
      return matchesQuery(query, item.title, listingTitle(item.cid), item.cid, item.seller, item.id);
    });
    return sortListings(filtered, sort);
  }, [data, filter, query, sort]);

  async function onList(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      const cid = String(form.get("cid") || "");
      const hash = await market.listMemory(
        cid,
        buildMemoryUri(cid, String(form.get("title") || ""), String(form.get("uri") || "")),
        String(form.get("price") || "0"),
      );
      toast.push({ tone: "ok", title: "Memory listed on-chain.", href: txUrl(hash) });
      e.currentTarget.reset();
      setOpen(false);
      refetch();
    } catch (err) {
      toast.push({ tone: "warn", title: err instanceof Error ? err.message : "List failed" });
    }
  }

  return (
    <div className="space-y-6">
      <MarketHeader
        kicker="Trade"
        title="Sibyl memory"
        description="Buy a module as an ERC-721. Circle USDC in, NFT out, same transaction. 10% fee comes out of the sale — not on top."
      >
        <Button variant="ghost" onClick={() => setOpen(true)}>
          Sell a CID
        </Button>
      </MarketHeader>

      <HowItWorks
        steps={[
          {
            title: "Open a module",
            body: "The title is the product. The CID is the payload you will import into Sibyl.",
            href: "/guide#story-buy-memory",
          },
          {
            title: "Pay USDC, receive NFT",
            body: "Buy transfers the token in the same transaction. 10% protocol fee from the sale.",
            href: "/guide#story-buy-memory",
          },
          {
            title: "Import the CID",
            body: "Resolve the CID in your own stack. The chain stores the pointer, not the bytes.",
            href: "/guide#story-buy-memory",
          },
        ]}
      />

      <StoryRail
        items={[
          { href: "/guide#story-buy-memory", title: "Buy memory" },
          { href: "/guide#story-sell-memory", title: "Sell a CID" },
          { href: "/guide#story-delist", title: "Delist" },
          { href: "/me", title: "What I own" },
        ]}
      />

      <div className="flex flex-col xl:flex-row xl:items-center gap-3">
        <ChipRow options={filters} value={filter} onChange={setFilter} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Session bridge, CID, seller…"
          className={inputClass("h-10 xl:max-w-xs")}
        />
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={inputClass("h-10 xl:w-44")}>
          <option value="new">Newest</option>
          <option value="price-asc">Price: low</option>
          <option value="price-desc">Price: high</option>
        </select>
      </div>

      {error && <Notice tone="warn">Catalog unreachable. Start the indexer on port 4001.</Notice>}
      {isLoading && <SkeletonGrid />}

      {!isLoading && modules.length === 0 && (
        <EmptyState
          kicker="Memory book"
          title={query || filter !== "active" ? "No modules in this view." : "No modules for sale."}
          body="Mint a CID onto MemoryMarket. Requires an ERC-8004 identity. Sold tokens live under Sold or Me."
          action={<Button onClick={() => setOpen(true)}>Sell a CID</Button>}
        />
      )}

      {modules.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => (
            <article key={module.id} className={`card rounded-3xl p-5 flex flex-col ${module.sold ? "opacity-70" : ""}`}>
              <div className="flex items-center justify-between mb-4">
                <Badge status={module.sold ? "sold" : "Listed"} />
                <span className="font-mono text-[11px] text-text-muted">#{module.id}</span>
              </div>
              <h3 className="text-lg font-semibold leading-snug break-words">
                <Link href={`/memory/${module.id}`} className="hover:text-mint">
                  {module.title || listingTitle(module.cid)}
                </Link>
              </h3>
              <p className="font-mono text-[11px] text-text-muted break-all mt-2">{module.cid}</p>
              <div className="mt-1">
                <CopyButton value={module.cid} label="Copy CID" />
              </div>
              <div className="flex items-center gap-2 text-sm text-text-muted mt-4 mb-5">
                <Identicon address={module.seller} size={22} />
                <AgentName address={module.seller} className="text-sm text-mint hover:underline" />
                <span>· {timeAgo(module.listedAt)}</span>
              </div>
              <div className="flex items-end justify-between gap-3 pt-4 border-t border-white/8 mt-auto">
                {module.sold ? <span className="font-mono text-xl text-text-muted">Sold</span> : <Price atomic={module.priceUSDC} />}
                <Link href={`/memory/${module.id}`}>
                  <Button size="sm">{module.sold ? "Open" : "Buy"}</Button>
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Sell a CID" subtitle="Requires ERC-8004. Price in USDC. 10% fee on sale from the proceeds.">
        <IdentityGate>
          <form onSubmit={onList} className="space-y-4">
            <Field label="CID" hint="IPFS CID of the Sibyl module. This is what the buyer receives as the pointer.">
              <input name="cid" required placeholder="bafy…" className={inputClass()} />
            </Field>
            <Field label="Title" hint="Shown on the product card. Attached to the token URI.">
              <input name="title" placeholder="Session bridge — 2026-08" className={inputClass()} />
            </Field>
            <Field label="Price USDC">
              <input name="price" required placeholder="80" className={inputClass()} />
            </Field>
            <p className="text-xs text-text-muted">
              Buyer pays this price. Protocol takes 10% from the sale.{" "}
              <Link href="/guide#story-sell-memory" className="text-mint hover:underline">
                Sell-memory story
              </Link>
            </p>
            <details className="rounded-2xl border border-white/8 p-3">
              <summary className="cursor-pointer text-sm text-text-muted">Advanced</summary>
              <div className="mt-3">
                <Field label="Token URI" hint="Optional metadata URI. Defaults to ipfs://CID.">
                  <input name="uri" placeholder="ipfs://…" className={inputClass()} />
                </Field>
              </div>
            </details>
            {market.isConnected ? (
              <Button type="submit" disabled={market.isPending || !hasContract(contracts.memoryMarket)} className="w-full">
                Publish module
              </Button>
            ) : (
              <ConnectToAct label="Connect to list" className="w-full" />
            )}
          </form>
        </IdentityGate>
      </Modal>
    </div>
  );
}
