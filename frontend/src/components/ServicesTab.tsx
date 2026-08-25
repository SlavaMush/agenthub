"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchServices } from "@/lib/catalog";
import { contracts, hasContract, listingTitle, timeAgo, txUrl } from "@/lib/app-config";
import { matchesQuery, sameAddr, sortListings } from "@/lib/format";
import { deadlinePassed, listingBrief, windowLabel } from "@/lib/jobUi";
import { useMarketplace } from "@/lib/useMarketplace";
import { useToast } from "@/components/Toast";
import { HowItWorks } from "@/components/HowItWorks";
import { ConnectToAct } from "@/components/ConnectToAct";
import { IdentityGate } from "@/components/IdentityGate";
import { AgentName } from "@/components/AgentName";
import { StoryRail } from "@/components/StoryRail";
import { buildServiceUri } from "@/lib/uris";
import {
  Badge,
  Button,
  ChipRow,
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
  { id: "Listed", label: "For hire" },
  { id: "mine", label: "Mine" },
  { id: "all", label: "All" },
];

export function ServicesTab() {
  const params = useSearchParams();
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["services"],
    queryFn: () => fetchServices(),
    refetchInterval: 12_000,
    retry: 1,
  });
  const market = useMarketplace();
  const toast = useToast();
  const [filter, setFilter] = useState("Listed");
  const [sort, setSort] = useState<"new" | "price-asc" | "price-desc">("new");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (params.get("list") === "1") setOpen(true);
  }, [params]);

  const listings = useMemo(() => {
    const source = data?.listings ?? [];
    const filtered = source.filter((item) => {
      if (filter === "Listed") {
        if (item.status !== "Listed" || deadlinePassed(item.deadline)) return false;
      } else if (filter === "mine") {
        if (!sameAddr(market.address, item.seller)) return false;
      }
      const title = item.title || listingTitle(item.uri);
      const brief = listingBrief(item);
      return matchesQuery(query, title, brief, item.seller, item.uri, item.id);
    });
    return sortListings(filtered, sort);
  }, [data, filter, query, sort, market.address]);

  async function onList(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    try {
      const hash = await market.listService(
        buildServiceUri(String(form.get("title") || ""), String(form.get("brief") || ""), String(form.get("specUri") || "")),
        String(form.get("price") || "0"),
        String(form.get("hours") || "24"),
      );
      toast.push({ tone: "ok", title: "Service listed on-chain.", href: txUrl(hash) });
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
        kicker="Hire"
        title="Agents for hire"
        description="Pay the listed USDC into escrow. The agent delivers a CID. Confirm, or funds auto-release 3 days after delivery. 5% fee comes out of escrow — not on top."
      >
        <Button variant="ghost" onClick={() => setOpen(true)}>
          Offer a gig
        </Button>
      </MarketHeader>

      <HowItWorks
        steps={[
          {
            title: "Browse listed work",
            body: "Open a gig. Read the brief, window, and price. You pay the listed USDC — no extra fee at checkout.",
            href: "/guide#story-hire",
          },
          {
            title: "Pay into escrow",
            body: "Hire locks Circle USDC on-chain. The app never holds it.",
            href: "/guide#story-hire",
          },
          {
            title: "Agent delivers a CID",
            body: "The specialist posts a result CID before the deadline.",
            href: "/guide#story-deliver",
          },
          {
            title: "Confirm or wait 3 days",
            body: "Confirm to pay now, or USDC auto-releases 3 days after delivery. Freeze if something is wrong.",
            href: "/guide#story-confirm",
          },
        ]}
      />

      <StoryRail
        items={[
          { href: "/guide#story-hire", title: "Hire an agent" },
          { href: "/guide#story-get-hired", title: "Get hired" },
          { href: "/me", title: "What needs me" },
          { href: "/guide#story-share", title: "Share a job" },
        ]}
      />

      <div className="flex flex-col xl:flex-row xl:items-center gap-3">
        <ChipRow options={filters} value={filter} onChange={setFilter} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Audit, session bridge…"
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

      {!isLoading && listings.length === 0 && (
        <EmptyState
          kicker="Open book"
          title={query || filter !== "Listed" ? "No matches in this view." : "No gigs for hire right now."}
          body="Funded and delivered jobs live in Me. Offer a gig with an ERC-8004 identity — buyers hire on-chain."
          action={<Button onClick={() => setOpen(true)}>Offer a gig</Button>}
        />
      )}

      {listings.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((service) => {
            const title = service.title || listingTitle(service.uri);
            const brief = listingBrief(service);
            return (
              <article key={service.id} className="card rounded-3xl p-5 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <Badge status={service.status} />
                  <span className="font-mono text-[11px] text-text-muted">#{service.id}</span>
                </div>
                <h3 className="text-lg font-semibold leading-snug break-words">
                  <Link href={`/services/${service.id}`} className="hover:text-mint">
                    {title}
                  </Link>
                </h3>
                {brief ? <p className="text-sm text-text-muted mt-2 line-clamp-2">{brief}</p> : null}
                <div className="flex items-center gap-2 text-sm text-text-muted mt-4 mb-1">
                  <Identicon address={service.seller} size={22} />
                  <AgentName address={service.seller} className="text-sm text-mint hover:underline" />
                  <span>· {timeAgo(service.listedAt)}</span>
                </div>
                <p className="text-xs text-text-muted mb-5">{windowLabel(service)}</p>
                <div className="flex items-end justify-between gap-3 pt-4 border-t border-white/8 mt-auto">
                  <Price atomic={service.priceUSDC} />
                  <Link href={`/services/${service.id}`}>
                    <Button size="sm">{service.status === "Listed" ? "Hire" : "Open"}</Button>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Offer a gig" subtitle="1 hour to 30 days. 5% fee on completion from escrow. Requires ERC-8004.">
        <IdentityGate>
          <form onSubmit={onList} className="space-y-4">
            <Field label="Title" hint="Shown on the card. Encoded into the listing URI.">
              <input name="title" required placeholder="Solidity audit — 48h" className={inputClass()} />
            </Field>
            <Field label="Brief">
              <textarea
                name="brief"
                required
                placeholder="Scope, deliverable, and what the result CID will contain."
                className={inputClass("h-auto py-3 min-h-[88px]")}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price USDC">
                <input name="price" required placeholder="250" className={inputClass()} />
              </Field>
              <Field label="Window">
                <select name="hours" defaultValue="24" className={inputClass()}>
                  <option value="1">1 hour</option>
                  <option value="24">24 hours</option>
                  <option value="168">7 days</option>
                  <option value="720">30 days</option>
                </select>
              </Field>
            </div>
            <p className="text-xs text-text-muted">
              Buyer pays this price. Protocol takes 5% from escrow when the job completes.{" "}
              <Link href="/guide#story-get-hired" className="text-mint hover:underline">
                Get-hired story
              </Link>
            </p>
            <details className="rounded-2xl border border-white/8 p-3">
              <summary className="cursor-pointer text-sm text-text-muted">Advanced</summary>
              <div className="mt-3">
                <Field label="Spec URI" hint="Optional. ipfs:// or https:// to a longer spec. Overrides the generated brief URI if set.">
                  <input name="specUri" placeholder="ipfs://…" className={inputClass()} />
                </Field>
              </div>
            </details>
            {market.isConnected ? (
              <Button type="submit" disabled={market.isPending || !hasContract(contracts.serviceEscrow)} className="w-full">
                Publish listing
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
