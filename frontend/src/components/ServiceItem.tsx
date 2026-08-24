"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchServiceById } from "@/lib/catalog";
import { addressUrl, listingTitle, shortAddr, timeAgo, txUrl } from "@/lib/app-config";
import { sameAddr } from "@/lib/format";
import { parseListingUri } from "@/lib/uris";
import { useMarketplace } from "@/lib/useMarketplace";
import { useToast } from "@/components/Toast";
import { PayButton, UsdcBalance } from "@/components/ConnectToAct";
import { Badge, Button, Field, Notice, Price, inputClass } from "@/components/ui";

export function ServiceItem({ id }: { id: string }) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["service", id],
    queryFn: () => fetchServiceById(id),
    refetchInterval: 12_000,
  });
  const market = useMarketplace();
  const toast = useToast();
  const [deliveryCid, setDeliveryCid] = useState("");

  async function run(title: string, fn: () => Promise<`0x${string}`>) {
    try {
      const hash = await fn();
      toast.push({ tone: "ok", title, href: txUrl(hash) });
      refetch();
    } catch (err) {
      toast.push({ tone: "warn", title: err instanceof Error ? err.message : "Transaction failed" });
    }
  }

  if (isLoading) return <p className="text-text-muted">Loading job…</p>;
  if (error || !data) return <Notice tone="warn">Job not found in the catalog.</Notice>;

  const detail = data;
  const parsed = parseListingUri(detail.uri);
  const title = detail.title || parsed.title || listingTitle(detail.uri);
  const isSeller = sameAddr(market.address, detail.seller);
  const isBuyer = sameAddr(market.address, detail.buyer);
  const pastDeadline = detail.deadline > 0 && Date.now() / 1000 > detail.deadline;

  return (
    <article className="max-w-xl space-y-5">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-mint mb-2">Job #{detail.id}</p>
        <h1 className="font-display text-3xl tracking-tight mb-2">{title}</h1>
        {detail.brief || parsed.brief ? (
          <p className="text-text-muted">{detail.brief || parsed.brief}</p>
        ) : null}
      </div>
      <div className="flex items-center justify-between">
        <Badge status={detail.status} />
        <Price atomic={detail.priceUSDC} size="xl" />
      </div>
      <dl className="space-y-2 text-sm">
        <Row label="Seller" value={shortAddr(detail.seller)} href={addressUrl(detail.seller)} />
        {detail.buyer && <Row label="Buyer" value={shortAddr(detail.buyer)} href={addressUrl(detail.buyer)} />}
        <Row label="Deadline" value={detail.deadline ? new Date(detail.deadline * 1000).toLocaleString() : "—"} />
        <Row label="Posted" value={timeAgo(detail.listedAt)} />
      </dl>
      {detail.cid && (
        <div className="rounded-2xl border border-mint/20 bg-mint/5 p-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-mint mb-1">Result CID</p>
          <p className="font-mono text-xs break-all">{detail.cid}</p>
        </div>
      )}
      {detail.status === "Funded" && isSeller && !pastDeadline && (
        <Field label="Result CID">
          <input value={deliveryCid} onChange={(e) => setDeliveryCid(e.target.value)} placeholder="bafy…" className={inputClass()} />
        </Field>
      )}
      <div className="space-y-2">
        {detail.status === "Listed" && !isSeller && (
          <>
            <UsdcBalance className="block text-center" />
            <PayButton className="w-full" connected={market.isConnected} pending={market.isPending} disconnectedLabel="Connect to hire" onClick={() => run(`Job #${detail.id} funded.`, () => market.fundService(detail.id, detail.priceUSDC))}>
              Fund escrow
            </PayButton>
          </>
        )}
        {detail.status === "Funded" && isSeller && !pastDeadline && (
          <Button className="w-full" disabled={market.isPending || !deliveryCid.trim()} onClick={() => run(`Job #${detail.id} delivered.`, () => market.deliverService(detail.id, deliveryCid.trim()))}>
            Deliver result
          </Button>
        )}
        {detail.status === "Delivered" && isBuyer && (
          <Button className="w-full" disabled={market.isPending} onClick={() => run(`Job #${detail.id} confirmed.`, () => market.confirmService(detail.id))}>
            Confirm and pay seller
          </Button>
        )}
        {detail.status === "Delivered" && (
          <Button variant="ghost" className="w-full" disabled={market.isPending} onClick={() => run(`Job #${detail.id} released.`, () => market.autoReleaseService(detail.id))}>
            Auto-release
          </Button>
        )}
        {detail.status === "Funded" && isBuyer && pastDeadline && (
          <Button className="w-full" disabled={market.isPending} onClick={() => run(`Job #${detail.id} refunded.`, () => market.refundService(detail.id))}>
            Refund after deadline
          </Button>
        )}
        {(detail.status === "Funded" || detail.status === "Delivered") && (isSeller || isBuyer) && (
          <Button variant="danger" className="w-full" disabled={market.isPending} onClick={() => run(`Job #${detail.id} frozen.`, () => market.freezeService(detail.id))}>
            Freeze dispute
          </Button>
        )}
      </div>
    </article>
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
