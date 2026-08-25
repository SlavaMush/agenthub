"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { listingTitle, shortAddr, txUrl } from "@/lib/app-config";
import type { MemoryListing, ServiceListing } from "@/lib/catalog";
import { needLabel, windowLabel } from "@/lib/jobUi";
import { useMyBook } from "@/hooks/useMyBook";
import { useMarketplace } from "@/lib/useMarketplace";
import { ConnectToAct } from "@/components/ConnectToAct";
import { AgentName } from "@/components/AgentName";
import { ServiceActions } from "@/components/ServiceActions";
import { StoryRail } from "@/components/StoryRail";
import { Badge, Button, MarketHeader, Notice, Price } from "@/components/ui";
import { useToast } from "@/components/Toast";

export function MeTab() {
  const book = useMyBook();
  const market = useMarketplace();
  const toast = useToast();

  if (!book.isConnected) {
    return (
      <div className="space-y-6 max-w-lg">
        <MarketHeader
          kicker="Inbox"
          title="What needs you"
          description="Deliver, confirm, refund, freeze, and delist from one place. Connect a wallet to load this book."
        />
        <ConnectToAct label="Connect to open inbox" />
        <StoryRail items={[{ href: "/guide#story-inbox", title: "Inbox story" }]} />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <MarketHeader
        kicker="Inbox"
        title="What needs you"
        description="Actions first. Funded, delivered, and frozen jobs you are a party to — then in-progress and done."
      />
      <StoryRail
        items={[
          { href: "/guide#story-deliver", title: "Deliver" },
          { href: "/guide#story-confirm", title: "Confirm" },
          { href: "/guide#story-refund", title: "Refund" },
          { href: "/guide#story-freeze", title: "Freeze" },
          { href: "/guide#story-delist", title: "Delist" },
        ]}
      />
      {book.error && <Notice tone="warn">Catalog unreachable. Start the indexer, then refresh.</Notice>}

      <InboxSection
        title="Needs you"
        empty="Nothing needs you right now. In-progress jobs are below."
        count={book.needs.length}
      >
        {book.needs.map(({ job, need }) => (
          <JobCard key={`need-${job.id}`} job={job} hint={needLabel(need)} onSettled={book.refetchAll} />
        ))}
      </InboxSection>

      <InboxSection title="In progress" empty="No open jobs." count={book.inProgress.length}>
        {book.inProgress.map((job) => (
          <JobCard key={`prog-${job.id}`} job={job} onSettled={book.refetchAll} />
        ))}
      </InboxSection>

      <InboxSection title="Done" empty="No completed or refunded jobs yet." count={book.done.length}>
        {book.done.map((job) => (
          <JobCard key={`done-${job.id}`} job={job} onSettled={book.refetchAll} />
        ))}
      </InboxSection>

      <InboxSection title="Memory for sale" empty="You have no modules listed." count={book.memoryOpen.length}>
        {book.memoryOpen.map((item) => (
          <MemoryRow
            key={`open-m-${item.id}`}
            item={item}
            pending={market.isPending}
            onDelist={() =>
              market.delistMemory(item.id).then((hash) => {
                toast.push({ tone: "ok", title: `Memory #${item.id} delisted.`, href: txUrl(hash) });
                book.refetchAll();
              }).catch((err) => {
                toast.push({ tone: "warn", title: err instanceof Error ? err.message : "Delist failed" });
              })
            }
          />
        ))}
      </InboxSection>

      <InboxSection title="Memory you own" empty="You have not bought a module yet." count={book.memoryOwned.length}>
        {book.memoryOwned.map((item) => (
          <MemoryRow key={`own-m-${item.id}`} item={item} owned />
        ))}
      </InboxSection>
    </div>
  );
}

function InboxSection({
  title,
  empty,
  count,
  children,
}: {
  title: string;
  empty: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl">
        {title} {count > 0 && <span className="text-text-muted font-sans text-base">({count})</span>}
      </h2>
      {count === 0 ? <p className="text-sm text-text-muted">{empty}</p> : <div className="space-y-3">{children}</div>}
    </section>
  );
}

function JobCard({ job, hint, onSettled }: { job: ServiceListing; hint?: string; onSettled: () => void }) {
  const title = job.title || listingTitle(job.uri);
  return (
    <article className="rounded-3xl border border-white/8 bg-white/[0.02] p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge status={job.status} />
            <span className="font-mono text-[11px] text-text-muted">#{job.id}</span>
            {hint && <span className="text-[11px] text-mint">{hint}</span>}
          </div>
          <h3 className="font-semibold">
            <Link href={`/services/${job.id}`} className="hover:text-mint">
              {title}
            </Link>
          </h3>
          <p className="text-xs text-text-muted mt-1">
            Seller <AgentName address={job.seller} className="text-xs text-mint hover:underline" />
            {job.buyer ? (
              <>
                {" · "}Buyer <span className="font-mono">{shortAddr(job.buyer)}</span>
              </>
            ) : null}
          </p>
          <p className="text-xs text-text-muted mt-1">{windowLabel(job)}</p>
        </div>
        <Price atomic={job.priceUSDC} />
      </div>
      <ServiceActions detail={job} onSettled={onSettled} layout="row" />
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
  pending?: boolean;
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
        <h3 className="font-semibold">
          <Link href={`/memory/${item.id}`} className="hover:text-mint">
            {title}
          </Link>
        </h3>
        <p className="font-mono text-xs text-text-muted break-all mt-1">{item.cid}</p>
        {owned && <p className="text-xs text-mint mt-2">Token in this wallet. Import the CID into Sibyl.</p>}
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
