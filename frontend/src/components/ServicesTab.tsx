"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchServices, type ServiceListing } from "@/lib/catalog";
import { addressUrl, contracts, hasContract, listingTitle, shortAddr, timeAgo, txUrl } from "@/lib/app-config";
import { matchesQuery, sameAddr, sortListings } from "@/lib/format";
import { useMarketplace } from "@/lib/useMarketplace";
import { useToast } from "@/components/Toast";
import { HowItWorks } from "@/components/HowItWorks";
import { ConnectToAct, PayButton, UsdcBalance } from "@/components/ConnectToAct";
import { IdentityGate } from "@/components/IdentityGate";
import { buildServiceUri, parseListingUri } from "@/lib/uris";
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
    queryFn: () => fetchServices(),
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
  const [deliveryCid, setDeliveryCid] = useState("");

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

  async function runAction(title: string, fn: () => Promise<`0x${string}`>) {
    try {
      const hash = await fn();
      toast.push({ tone: "ok", title, href: txUrl(hash) });
      refetch();
      setDetail(null);
      setDeliveryCid("");
    } catch (err) {
      toast.push({ tone: "warn", title: err instanceof Error ? err.message : "Transaction failed" });
    }
  }

  function onFund(item: ServiceListing) {
    return runAction(`Job #${item.id} funded.`, () => market.fundService(item.id, item.priceUSDC));
  }

  return (
    <div className="space-y-6">
      <MarketHeader
        kicker="Hire"
        title="Open jobs"
        description="Fund a listed specialist in Circle USDC. Released on delivery or timeout. 5% protocol fee."
      >
        <Button variant="ghost" onClick={() => setOpen(true)}>
          Offer a service
        </Button>
      </MarketHeader>

      <HowItWorks
        steps={[
          { title: "Seller lists", body: "Identity-gated. Post a brief, a USDC price, and a window from 1 hour to 30 days." },
          { title: "Buyer funds", body: "Fund locks Circle USDC in ServiceEscrow. The app never holds it. 5% fee on completion." },
          { title: "Deliver, then settle", body: "Open the job. Seller posts a result CID. Buyer confirms, or payout auto-releases 3 days after delivery." },
        ]}
      />

      <div className="flex flex-col xl:flex-row xl:items-center gap-3">
        <ChipRow options={filters} value={filter} onChange={setFilter} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search brief, seller, or id"
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
          title={query || filter !== "all" ? "No matches in this view." : "No services on the tape."}
          body="Post a job with an ERC-8004 identity. Buyers fund on-chain; the app never holds USDC."
          action={<Button onClick={() => setOpen(true)}>List a service</Button>}
        />
      )}

      {listings.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((service) => (
            <article key={service.id} className="card rounded-3xl p-5">
              <div className="flex items-center justify-between mb-4">
                <Badge status={service.status} />
                <span className="font-mono text-[11px] text-text-muted">#{service.id}</span>
              </div>
              <h3 className="text-lg font-semibold leading-snug mb-4 break-words"><Link href={`/services/${service.id}`} className="hover:text-mint">{service.title || listingTitle(service.uri)}</Link></h3>
              <div className="flex items-center gap-2 text-sm text-text-muted mb-5">
                <Identicon address={service.seller} size={22} />
                <span className="font-mono">{shortAddr(service.seller)}</span>
                <span>· {timeAgo(service.listedAt)}</span>
              </div>
              <div className="flex items-end justify-between gap-3 pt-4 border-t border-white/8" onClick={(e) => e.stopPropagation()}>
                <div>
                  <Price atomic={service.priceUSDC} />
                </div>
                {service.status === "Listed" ? (
                  <PayButton
                    size="sm"
                    connected={market.isConnected}
                    pending={market.isPending}
                    disconnectedLabel="Connect to hire"
                    onClick={() => onFund(service)}
                  >
                    Fund
                  </PayButton>
                ) : (
                  <Button size="sm" disabled>
                    Fund
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="List a service" subtitle="1 hour to 30 days. 5% fee on completion. Requires ERC-8004.">
        <IdentityGate>
<form onSubmit={onList} className="space-y-4">
          <Field label="Title" hint="Shown on the card. Encoded into the listing URI.">
            <input name="title" required placeholder="Solidity audit — 48h" className={inputClass()} />
          </Field>
          <Field label="Brief">
            <textarea name="brief" required placeholder="Scope, deliverable, and what the result CID will contain." className={inputClass("h-auto py-3 min-h-[88px]")} />
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

      <Modal
        open={Boolean(detail)}
        onClose={() => {
          setDetail(null);
          setDeliveryCid("");
        }}
        title={detail ? listingTitle(detail.uri) : ""}
        subtitle={detail ? `Job #${detail.id}` : ""}
      >
        {detail && (
          <ServiceDetail
            detail={detail}
            market={market}
            deliveryCid={deliveryCid}
            setDeliveryCid={setDeliveryCid}
            onFund={() => onFund(detail)}
            onDeliver={() => runAction(`Job #${detail.id} delivered.`, () => market.deliverService(detail.id, deliveryCid.trim()))}
            onConfirm={() => runAction(`Job #${detail.id} confirmed.`, () => market.confirmService(detail.id))}
            onRefund={() => runAction(`Job #${detail.id} refunded.`, () => market.refundService(detail.id))}
            onAutoRelease={() => runAction(`Job #${detail.id} released.`, () => market.autoReleaseService(detail.id))}
            onFreeze={() => runAction(`Job #${detail.id} frozen.`, () => market.freezeService(detail.id))}
          />
        )}
      </Modal>
    </div>
  );
}

function ServiceDetail({
  detail,
  market,
  deliveryCid,
  setDeliveryCid,
  onFund,
  onDeliver,
  onConfirm,
  onRefund,
  onAutoRelease,
  onFreeze,
}: {
  detail: ServiceListing;
  market: ReturnType<typeof useMarketplace>;
  deliveryCid: string;
  setDeliveryCid: (value: string) => void;
  onFund: () => void;
  onDeliver: () => void;
  onConfirm: () => void;
  onRefund: () => void;
  onAutoRelease: () => void;
  onFreeze: () => void;
}) {
  const parsed = parseListingUri(detail.uri);
  const isSeller = sameAddr(market.address, detail.seller);
  const isBuyer = sameAddr(market.address, detail.buyer);
  const isParty = isSeller || isBuyer;
  const deadlineMs = detail.deadline ? detail.deadline * 1000 : 0;
  const pastDeadline = deadlineMs > 0 && Date.now() > deadlineMs;
  const canFund = detail.status === "Listed" && !isSeller;
  const canDeliver = detail.status === "Funded" && isSeller && !pastDeadline;
  const canRefund = detail.status === "Funded" && isBuyer && pastDeadline;
  const canConfirm = detail.status === "Delivered" && isBuyer;
  const canAutoRelease = detail.status === "Delivered";
  const canFreeze = (detail.status === "Funded" || detail.status === "Delivered") && isParty;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge status={detail.status} />
        <Price atomic={detail.priceUSDC} size="xl" />
      </div>
      {parsed.brief && <p className="text-sm text-text-muted leading-relaxed">{parsed.brief}</p>}
      <dl className="space-y-2 text-sm">
        <Row label="Seller" value={shortAddr(detail.seller)} href={addressUrl(detail.seller)} />
        {detail.buyer && <Row label="Buyer" value={shortAddr(detail.buyer)} href={addressUrl(detail.buyer)} />}
        <Row label="Deadline" value={detail.deadline ? new Date(deadlineMs).toLocaleString() : "—"} />
        <Row label="Posted" value={timeAgo(detail.listedAt)} />
      </dl>
      {detail.cid && (
        <div className="rounded-2xl border border-mint/20 bg-mint/5 p-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-mint mb-1">Result CID</p>
          <p className="font-mono text-xs break-all">{detail.cid}</p>
        </div>
      )}
      <div className="rounded-2xl border border-white/8 bg-black/20 p-3 font-mono text-xs break-all text-text-muted">
        {detail.uri}
        <div className="mt-2">
          <CopyButton value={detail.uri} label="Copy URI" />
        </div>
      </div>
      {canDeliver && (
        <Field label="Result CID" hint="IPFS CID of the deliverable. Must be posted before the deadline.">
          <input value={deliveryCid} onChange={(e) => setDeliveryCid(e.target.value)} placeholder="bafy…" className={inputClass()} />
        </Field>
      )}
      <div className="space-y-2">
        {canFund && (
          <>
            <UsdcBalance className="block text-center mb-1" />
            <PayButton
              className="w-full"
              connected={market.isConnected}
              pending={market.isPending}
              disconnectedLabel="Connect to hire"
              onClick={onFund}
            >
              Fund escrow
            </PayButton>
          </>
        )}
        {canDeliver && (
          <Button className="w-full" disabled={!market.isConnected || market.isPending || !deliveryCid.trim()} onClick={onDeliver}>
            Deliver result
          </Button>
        )}
        {canConfirm && (
          <Button className="w-full" disabled={!market.isConnected || market.isPending} onClick={onConfirm}>
            Confirm and pay seller
          </Button>
        )}
        {canAutoRelease && (
          <Button variant="ghost" className="w-full" disabled={!market.isConnected || market.isPending} onClick={onAutoRelease}>
            Auto-release (3 days after delivery)
          </Button>
        )}
        {canRefund && (
          <Button className="w-full" disabled={!market.isConnected || market.isPending} onClick={onRefund}>
            Refund after deadline
          </Button>
        )}
        {canFreeze && (
          <Button variant="danger" className="w-full" disabled={!market.isConnected || market.isPending} onClick={onFreeze}>
            Freeze dispute
          </Button>
        )}
        {detail.status === "Listed" && isSeller && (
          <p className="text-xs text-text-muted text-center">Waiting for a buyer to fund this job.</p>
        )}
        {detail.status === "Funded" && isSeller && pastDeadline && (
          <p className="text-xs text-text-muted text-center">Deadline passed. Buyer can refund.</p>
        )}

      </div>
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
