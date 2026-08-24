"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchServices, type ServiceListing } from "@/lib/catalog";
import { addressUrl, contracts, hasContract, listingTitle, shortAddr, timeAgo, txUrl } from "@/lib/app-config";
import { matchesQuery, sortListings } from "@/lib/format";
import { useMarketplace } from "@/lib/useMarketplace";
import { useToast } from "@/components/Toast";
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
  { id: "Listed", label: "Listed" },
  { id: "Funded", label: "Funded" },
  { id: "Delivered", label: "Delivered" },
  { id: "Completed", label: "Completed" },
];

export function ServicesTab() {
  const params = useSearchParams();
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["services"],
    queryFn: fetchServices,
    refetchInterval: 12_000,
    retry: 1,
  });
  const market = useMarketplace();
  const toast = useToast();
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<"new" | "price-asc" | "price-desc">("new");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<ServiceListing | null>(null);

  useEffect(() => {
    if (params.get("list") === "1") setOpen(true);
  }, [params]);

  const listings = useMemo(() => {
    const source = data?.listings ?? [];
    const filtered = source.filter((item) => {
      if (filter !== "all" && item.status !== filter) return false;
      return matchesQuery(query, listingTitle(item.uri), item.seller, item.uri, item.id);
    });
    return sortListings(filtered, sort);
  }, [data, filter, query, sort]);

  async function onList(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      const hash = await market.listService(String(form.get("uri") || ""), String(form.get("price") || "0"), String(form.get("hours") || "24"));
      toast.push({ tone: "ok", title: "Service listed on-chain.", href: txUrl(hash) });
      e.currentTarget.reset();
      setOpen(false);
      refetch();
    } catch (err) {
      toast.push({ tone: "warn", title: err instanceof Error ? err.message : "List failed" });
    }
  }

  async function onFund(item: ServiceListing) {
    try {
      const hash = await market.fundService(item.id, item.priceUSDC);
      toast.push({ tone: "ok", title: `Job #${item.id} funded.`, href: txUrl(hash) });
      refetch();
      setDetail(null);
    } catch (err) {
      toast.push({ tone: "warn", title: err instanceof Error ? err.message : "Fund failed" });
    }
  }

  return (
    <div className="space-y-6">
      <MarketHeader
        kicker="Hire"
        title="Services"
        description="Escrowed Circle USDC. Released on delivery or timeout. 5% protocol fee."
      >
        <Button onClick={() => setOpen(true)}>List a service</Button>
      </MarketHeader>

      <div className="flex flex-col xl:flex-row xl:items-center gap-3">
        <ChipRow options={filters} value={filter} onChange={setFilter} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search brief, seller, or id"
          className={inputClass("h-10 xl:max-w-xs")}
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className={inputClass("h-10 xl:w-44")}
        >
          <option value="new">Newest</option>
          <option value="price-asc">Price: low</option>
          <option value="price-desc">Price: high</option>
        </select>
      </div>

      {error && <Notice tone="warn">Catalog unreachable. Start the indexer on port 4001.</Notice>}
      {isLoading && <SkeletonGrid />}

      {!isLoading && listings.length === 0 && (
        <EmptyState
          kicker="Open book"
          title={query || filter !== "all" ? "No matches in this view." : "No services on the tape."}
          body="Post a job with an ERC-8004 identity. Buyers fund on-chain; the app never holds USDC."
          action={<Button onClick={() => setOpen(true)}>List a service</Button>}
        />
      )}

      {listings.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((service) => (
            <article
              key={service.id}
              className="card rounded-3xl p-5 cursor-pointer"
              onClick={() => setDetail(service)}
            >
              <div className="flex items-center justify-between mb-4">
                <Badge status={service.status} />
                <span className="font-mono text-[11px] text-text-muted">#{service.id}</span>
              </div>
              <h3 className="text-lg font-semibold leading-snug mb-4 break-words">{listingTitle(service.uri)}</h3>
              <div className="flex items-center gap-2 text-sm text-text-muted mb-5">
                <Identicon address={service.seller} size={22} />
                <span className="font-mono">{shortAddr(service.seller)}</span>
                <span>· {timeAgo(service.listedAt)}</span>
              </div>
              <div className="flex items-end justify-between gap-3 pt-4 border-t border-white/8" onClick={(e) => e.stopPropagation()}>
                <Price atomic={service.priceUSDC} />
                <Button
                  size="sm"
                  disabled={service.status !== "Listed" || !market.isConnected || market.isPending}
                  onClick={() => onFund(service)}
                >
                  Fund
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="List a service" subtitle="1 hour to 30 days. 5% fee on completion.">
        <form onSubmit={onList} className="space-y-4">
          <Field label="Brief URI" hint="ipfs:// or https:// specification">
            <input name="uri" required placeholder="ipfs://…" className={inputClass()} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price USDC">
              <input name="price" required placeholder="250" className={inputClass()} />
            </Field>
            <Field label="Duration (hours)">
              <input name="hours" defaultValue="24" className={inputClass()} />
            </Field>
          </div>
          <Button type="submit" disabled={!market.isConnected || market.isPending || !hasContract(contracts.serviceEscrow)} className="w-full">
            {market.isConnected ? "Publish listing" : "Connect wallet to list"}
          </Button>
        </form>
      </Modal>

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? listingTitle(detail.uri) : ""}
        subtitle={detail ? `Job #${detail.id}` : ""}
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge status={detail.status} />
              <Price atomic={detail.priceUSDC} size="xl" />
            </div>
            <dl className="space-y-2 text-sm">
              <Row label="Seller" value={shortAddr(detail.seller)} href={addressUrl(detail.seller)} />
              <Row label="Deadline" value={detail.deadline ? new Date(detail.deadline * 1000).toLocaleString() : "—"} />
              <Row label="Posted" value={timeAgo(detail.listedAt)} />
            </dl>
            <div className="rounded-2xl border border-white/8 bg-black/20 p-3 font-mono text-xs break-all text-text-muted">
              {detail.uri}
              <div className="mt-2">
                <CopyButton value={detail.uri} label="Copy URI" />
              </div>
            </div>
            <Button
              className="w-full"
              disabled={detail.status !== "Listed" || !market.isConnected || market.isPending}
              onClick={() => onFund(detail)}
            >
              Fund escrow
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Row({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-text-muted">{label}</dt>
      <dd>
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="font-mono hover:text-mint">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
