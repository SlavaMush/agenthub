"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMemory, fetchServices, type MemoryListing, type ServiceListing } from "@/lib/catalog";
import { listingTitle, shortAddr, txUrl } from "@/lib/app-config";
import { useMarketplace } from "@/lib/useMarketplace";
import { useToast } from "@/components/Toast";
import { ConnectToAct } from "@/components/ConnectToAct";
import { Badge, Button, Field, MarketHeader, Notice, Price, inputClass } from "@/components/ui";

export function MeTab() {
  const market = useMarketplace();
  const toast = useToast();
  const address = market.address;
  const enabled = Boolean(address);

  const listedJobs = useQuery({
    queryKey: ["me", "jobs-listed", address],
    queryFn: () => fetchServices({ seller: address, limit: 200 }),
    enabled,
    refetchInterval: 12_000,
  });
  const hiredJobs = useQuery({
    queryKey: ["me", "jobs-hired", address],
    queryFn: () => fetchServices({ buyer: address, limit: 200 }),
    enabled,
    refetchInterval: 12_000,
  });
  const listedMemory = useQuery({
    queryKey: ["me", "memory-listed", address],
    queryFn: () => fetchMemory({ seller: address, limit: 200 }),
    enabled,
    refetchInterval: 12_000,
  });
  const boughtMemory = useQuery({
    queryKey: ["me", "memory-bought", address],
    queryFn: () => fetchMemory({ buyer: address, limit: 200 }),
    enabled,
    refetchInterval: 12_000,
  });

  async function run(title: string, fn: () => Promise<`0x${string}`>) {
    try {
      const hash = await fn();
      toast.push({ tone: "ok", title, href: txUrl(hash) });
      listedJobs.refetch();
      hiredJobs.refetch();
      listedMemory.refetch();
      boughtMemory.refetch();
    } catch (err) {
      toast.push({ tone: "warn", title: err instanceof Error ? err.message : "Transaction failed" });
    }
  }

  if (!market.isConnected) {
    return (
      <div className="space-y-6 max-w-lg">
        <MarketHeader kicker="Inbox" title="Your jobs" description="Deliver, confirm, refund, and delist from one place. Connect a wallet to load this book." />
        <ConnectToAct label="Connect to open inbox" />
      </div>
    );
  }

  const error = listedJobs.error || hiredJobs.error || listedMemory.error || boughtMemory.error;

  return (
    <div className="space-y-10">
      <MarketHeader
        kicker="Inbox"
        title="Your jobs"
        description="Next actions for jobs you listed or funded, and memory you listed or bought."
      />
      {error && <Notice tone="warn">Catalog unreachable. Start the indexer, then refresh.</Notice>}

      <InboxSection title="Jobs you listed" empty="You have not listed a service yet.">
        {(listedJobs.data?.listings ?? []).map((job) => (
          <JobRow
            key={`listed-${job.id}`}
            job={job}
            role="seller"
            pending={market.isPending}
            onDeliver={(cid) => run(`Job #${job.id} delivered.`, () => market.deliverService(job.id, cid))}
            onFreeze={() => run(`Job #${job.id} frozen.`, () => market.freezeService(job.id))}
          />
        ))}
      </InboxSection>

      <InboxSection title="Jobs you funded" empty="You have not funded a job yet.">
        {(hiredJobs.data?.listings ?? []).map((job) => (
          <JobRow
            key={`hired-${job.id}`}
            job={job}
            role="buyer"
            pending={market.isPending}
            onConfirm={() => run(`Job #${job.id} confirmed.`, () => market.confirmService(job.id))}
            onRefund={() => run(`Job #${job.id} refunded.`, () => market.refundService(job.id))}
            onAutoRelease={() => run(`Job #${job.id} released.`, () => market.autoReleaseService(job.id))}
            onFreeze={() => run(`Job #${job.id} frozen.`, () => market.freezeService(job.id))}
          />
        ))}
      </InboxSection>

      <InboxSection title="Memory you listed" empty="You have not listed a module yet.">
        {(listedMemory.data?.modules ?? []).map((item) => (
          <MemoryRow
            key={`listed-m-${item.id}`}
            item={item}
            pending={market.isPending}
            onDelist={item.active && !item.sold ? () => run(`Memory #${item.id} delisted.`, () => market.delistMemory(item.id)) : undefined}
          />
        ))}
      </InboxSection>

      <InboxSection title="Memory you bought" empty="You have not bought a module yet.">
        {(boughtMemory.data?.modules ?? []).map((item) => (
          <MemoryRow key={`bought-m-${item.id}`} item={item} owned pending={market.isPending} />
        ))}
      </InboxSection>
    </div>
  );
}

function InboxSection({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const items = useMemo(() => (Array.isArray(children) ? children : [children]).filter(Boolean), [children]);
  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl">{title}</h2>
      {items.length === 0 ? <p className="text-sm text-text-muted">{empty}</p> : <div className="space-y-3">{children}</div>}
    </section>
  );
}

function JobRow({
  job,
  role,
  pending,
  onDeliver,
  onConfirm,
  onRefund,
  onAutoRelease,
  onFreeze,
}: {
  job: ServiceListing;
  role: "seller" | "buyer";
  pending: boolean;
  onDeliver?: (cid: string) => void;
  onConfirm?: () => void;
  onRefund?: () => void;
  onAutoRelease?: () => void;
  onFreeze?: () => void;
}) {
  const [cid, setCid] = useState("");
  const pastDeadline = job.deadline > 0 && Date.now() / 1000 > job.deadline;
  const title = job.title || listingTitle(job.uri);
  return (
    <article className="rounded-3xl border border-white/8 bg-white/[0.02] p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge status={job.status} />
            <span className="font-mono text-[11px] text-text-muted">#{job.id}</span>
          </div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-text-muted font-mono mt-1">
            {role === "seller" ? `Buyer ${job.buyer ? shortAddr(job.buyer) : "—"}` : `Seller ${shortAddr(job.seller)}`}
          </p>
        </div>
        <Price atomic={job.priceUSDC} />
      </div>
      {job.status === "Funded" && role === "seller" && onDeliver && !pastDeadline && (
        <div className="flex flex-col sm:flex-row gap-2">
          <Field label="Result CID">
            <input value={cid} onChange={(e) => setCid(e.target.value)} placeholder="bafy…" className={inputClass()} />
          </Field>
          <Button className="sm:self-end" disabled={pending || !cid.trim()} onClick={() => onDeliver(cid.trim())}>
            Deliver
          </Button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {job.status === "Delivered" && role === "buyer" && onConfirm && (
          <Button disabled={pending} onClick={onConfirm}>Confirm</Button>
        )}
        {job.status === "Delivered" && onAutoRelease && (
          <Button variant="ghost" disabled={pending} onClick={onAutoRelease}>Auto-release</Button>
        )}
        {job.status === "Funded" && role === "buyer" && pastDeadline && onRefund && (
          <Button disabled={pending} onClick={onRefund}>Refund</Button>
        )}
        {job.status === "Frozen" && (
          <p className="text-xs text-amber-200">Frozen — protocol owner resolves.</p>
        )}
        {(job.status === "Funded" || job.status === "Delivered") && onFreeze && (
          <Button variant="danger" disabled={pending} onClick={onFreeze}>Freeze</Button>
        )}
        {job.status === "Listed" && role === "seller" && (
          <p className="text-xs text-text-muted">Waiting for a buyer to fund.</p>
        )}
      </div>
    </article>
  );
}

function MemoryRow({
  item,
  owned,
  pending,
  onDelist,
}: {
  item: MemoryListing;
  owned?: boolean;
  pending: boolean;
  onDelist?: () => void;
}) {
  const title = item.title || listingTitle(item.cid);
  return (
    <article className="rounded-3xl border border-white/8 bg-white/[0.02] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Badge status={item.sold ? "sold" : "Listed"} />
          <span className="font-mono text-[11px] text-text-muted">#{item.id}</span>
        </div>
        <h3 className="font-semibold">{title}</h3>
        <p className="font-mono text-xs text-text-muted break-all mt-1">{item.cid}</p>
        {owned && <p className="text-xs text-mint mt-2">You own this NFT. Resolve the CID in your stack.</p>}
      </div>
      <div className="flex items-center gap-3">
        <Price atomic={item.priceUSDC} />
        {onDelist && (
          <Button variant="ghost" disabled={pending} onClick={onDelist}>
            Delist
          </Button>
        )}
      </div>
    </article>
  );
}
