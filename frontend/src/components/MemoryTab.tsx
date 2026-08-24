"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchMemory, type MemoryListing } from "@/lib/catalog";
import { addressUrl, contracts, hasContract, listingTitle, shortAddr, timeAgo, txUrl } from "@/lib/app-config";
import { matchesQuery, sameAddr, sortListings } from "@/lib/format";
import { useMarketplace } from "@/lib/useMarketplace";
import { useToast } from "@/components/Toast";
import { HowItWorks } from "@/components/HowItWorks";
import { ConnectToAct, PayButton, UsdcBalance } from "@/components/ConnectToAct";
import { IdentityGate } from "@/components/IdentityGate";
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
  { id: "all", label: "All" },
  { id: "active", label: "For sale" },
  { id: "sold", label: "Sold" },
];

export function MemoryTab() {
  const params = useSearchParams();
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["memory"],
    queryFn: fetchMemory,
    refetchInterval: 12_000,
    retry: 1,
  });
  const market = useMarketplace();
  const toast = useToast();
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<"new" | "price-asc" | "price-desc">("new");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<MemoryListing | null>(null);

  useEffect(() => {
    if (params.get("list") === "1") setOpen(true);
  }, [params]);

  const modules = useMemo(() => {
    const source = data?.modules ?? [];
    const filtered = source.filter((item) => {
      if (filter === "active" && (!item.active || item.sold)) return false;
      if (filter === "sold" && !item.sold) return false;
      return matchesQuery(query, listingTitle(item.cid), item.cid, item.seller, item.id);
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

  async function onBuy(item: MemoryListing) {
    try {
      const hash = await market.buyMemory(item.id, item.priceUSDC);
      toast.push({ tone: "ok", title: `Memory #${item.id} purchased.`, href: txUrl(hash) });
      refetch();
      setDetail(null);
    } catch (err) {
      toast.push({ tone: "warn", title: err instanceof Error ? err.message : "Buy failed" });
    }
  }

  async function onDelist(item: MemoryListing) {
    try {
      const hash = await market.delistMemory(item.id);
      toast.push({ tone: "ok", title: `Memory #${item.id} delisted.`, href: txUrl(hash) });
      refetch();
      setDetail(null);
    } catch (err) {
      toast.push({ tone: "warn", title: err instanceof Error ? err.message : "Delist failed" });
    }
  }

  return (
    <div className="space-y-6">
      <MarketHeader
        kicker="Trade"
        title="Memory for sale"
        description="Buy a Sibyl module as an ERC-721. Circle USDC in, NFT out, in the same transaction. 10% fee."
      >
        <Button variant="ghost" onClick={() => setOpen(true)}>
          Sell a module
        </Button>
      </MarketHeader>

      <HowItWorks
        steps={[
          { title: "Pin a module", body: "The CID is the Sibyl payload. The chain stores the pointer and a hash, not the bytes." },
          { title: "List as NFT", body: "Requires ERC-8004. Set a USDC price. Token URI is metadata — default ipfs://CID, optional title." },
          { title: "Buy transfers the NFT", body: "Buyer pays USDC in the same transaction. 10% fee to treasury. Then resolve the CID in your own stack." },
        ]}
      />

      <div className="flex flex-col xl:flex-row xl:items-center gap-3">
        <ChipRow options={filters} value={filter} onChange={setFilter} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search CID or seller"
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
          title={query || filter !== "all" ? "No modules in this view." : "No modules listed yet."}
          body="Mint a CID onto MemoryMarket. Requires an ERC-8004 identity."
          action={<Button onClick={() => setOpen(true)}>List memory</Button>}
        />
      )}

      {modules.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => (
            <article
              key={module.id}
              className={`card rounded-3xl p-5 cursor-pointer ${module.sold ? "opacity-70" : ""}`}
              onClick={() => setDetail(module)}
            >
              <div className="flex items-center justify-between mb-4">
                <Badge status={module.sold ? "sold" : "Listed"} />
                <span className="font-mono text-[11px] text-text-muted">#{module.id}</span>
              </div>
              <h3 className="text-lg font-semibold leading-snug mb-2 break-all">{listingTitle(module.cid)}</h3>
              <div className="mb-4" onClick={(e) => e.stopPropagation()}>
                <CopyButton value={module.cid} label="Copy CID" />
              </div>
              <div className="flex items-center gap-2 text-sm text-text-muted mb-5">
                <Identicon address={module.seller} size={22} />
                <span className="font-mono">{shortAddr(module.seller)}</span>
                <span>· {timeAgo(module.listedAt)}</span>
              </div>
              <div className="flex items-end justify-between gap-3 pt-4 border-t border-white/8" onClick={(e) => e.stopPropagation()}>
                {module.sold ? <span className="font-mono text-xl text-text-muted">Sold</span> : <Price atomic={module.priceUSDC} />}
                {!module.sold && module.active ? (
                  <PayButton
                    size="sm"
                    connected={market.isConnected}
                    pending={market.isPending}
                    disconnectedLabel="Connect to buy"
                    onClick={() => onBuy(module)}
                  >
                    Buy
                  </PayButton>
                ) : (
                  <Button size="sm" disabled>
                    Buy
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="List memory" subtitle="Requires ERC-8004. Price in USDC. 10% fee on sale.">
        <IdentityGate>
<form onSubmit={onList} className="space-y-4">
          <Field label="CID" hint="IPFS CID of the Sibyl module. This is what the buyer receives as the pointer.">
            <input name="cid" required placeholder="bafy…" className={inputClass()} />
          </Field>
          <Field label="Title" hint="Optional. Attached to the token URI for wallets and explorers.">
            <input name="title" placeholder="Session bridge — 2026-08" className={inputClass()} />
          </Field>
          <Field label="Token URI" hint="Optional metadata URI. Defaults to ipfs://CID.">
            <input name="uri" placeholder="ipfs://…" className={inputClass()} />
          </Field>
          <Field label="Price USDC">
            <input name="price" required placeholder="80" className={inputClass()} />
          </Field>
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

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detail ? listingTitle(detail.cid) : ""} subtitle={detail ? `Token #${detail.id}` : ""}>
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge status={detail.sold ? "sold" : "Listed"} />
              {detail.sold ? <span className="font-mono text-2xl text-text-muted">Sold</span> : <Price atomic={detail.priceUSDC} size="xl" />}
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/20 p-3 font-mono text-xs break-all">
              {detail.cid}
              <div className="mt-2">
                <CopyButton value={detail.cid} />
              </div>
            </div>
            <a href={addressUrl(detail.seller)} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm hover:text-mint">
              <Identicon address={detail.seller} size={28} />
              {shortAddr(detail.seller)}
            </a>
            {!detail.sold && detail.active && sameAddr(market.address, detail.seller) && (
              <Button variant="ghost" className="w-full" disabled={!market.isConnected || market.isPending} onClick={() => onDelist(detail)}>
                Delist
              </Button>
            )}
            {!detail.sold && detail.active && (
              <>
                <UsdcBalance className="block text-center" />
                <PayButton
                  className="w-full"
                  connected={market.isConnected}
                  pending={market.isPending}
                  disconnectedLabel="Connect to buy"
                  onClick={() => onBuy(detail)}
                >
                  Buy with USDC
                </PayButton>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
