"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchServiceById } from "@/lib/catalog";
import { listingTitle, timeAgo } from "@/lib/app-config";
import { listingBrief, serviceFeeHint, windowLabel } from "@/lib/jobUi";
import { Badge, CopyButton, Identicon, Notice, Price } from "@/components/ui";
import { AgentName } from "@/components/AgentName";
import { JobStepper } from "@/components/JobStepper";
import { ServiceActions } from "@/components/ServiceActions";
import { StoryRail } from "@/components/StoryRail";

export function ServiceItem({ id }: { id: string }) {
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ["service", id],
    queryFn: () => fetchServiceById(id),
    refetchInterval: 12_000,
  });

  if (isLoading) return <p className="text-text-muted">Loading job…</p>;
  if (error || !data) return <Notice tone="warn">Job not found in the catalog.</Notice>;

  const detail = data;
  const title = detail.title || listingTitle(detail.uri);
  const brief = listingBrief(detail);
  const shareUrl = typeof window !== "undefined" ? window.location.href : `/services/${detail.id}`;

  return (
    <article className="max-w-xl space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-mint mb-2">Job #{detail.id}</p>
        <h1 className="font-display text-3xl tracking-tight mb-2">{title}</h1>
        {brief ? <p className="text-text-muted leading-relaxed">{brief}</p> : null}
      </div>

      <JobStepper status={detail.status} />

      <div className="flex items-center justify-between">
        <Badge status={detail.status} />
        <Price atomic={detail.priceUSDC} size="xl" />
      </div>
      <p className="text-sm text-text-muted">{serviceFeeHint(detail.priceUSDC)}</p>
      <p className="text-sm text-text-muted">{windowLabel(detail)}</p>

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-3 items-center">
          <dt className="text-text-muted">Seller</dt>
          <dd className="flex items-center gap-2">
            <Identicon address={detail.seller} size={22} />
            <AgentName address={detail.seller} />
          </dd>
        </div>
        {detail.buyer && (
          <div className="flex justify-between gap-3 items-center">
            <dt className="text-text-muted">Buyer</dt>
            <dd>
              <AgentName address={detail.buyer} />
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-text-muted">Posted</dt>
          <dd>{timeAgo(detail.listedAt)}</dd>
        </div>
      </dl>

      {detail.cid && (
        <div className="rounded-2xl border border-mint/20 bg-mint/5 p-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-mint mb-1">Result CID</p>
          <p className="font-mono text-xs break-all">{detail.cid}</p>
          <div className="mt-2">
            <CopyButton value={detail.cid} label="Copy CID" />
          </div>
        </div>
      )}

      <ServiceActions detail={detail} onSettled={() => refetch()} />

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/8">
        <CopyButton value={shareUrl} label="Copy job link" />
        <Link href="/guide#story-hire" className="text-xs text-text-muted hover:text-mint">
          Hire story
        </Link>
      </div>

      <StoryRail
        kicker="Next in this story"
        items={[
          { href: "/guide#story-hire", title: "Hire" },
          { href: "/guide#story-deliver", title: "Deliver" },
          { href: "/guide#story-confirm", title: "Confirm / 3-day release" },
          { href: "/guide#story-refund", title: "Refund" },
          { href: "/guide#story-freeze", title: "Freeze" },
          { href: "/me", title: "Inbox" },
        ]}
      />
    </article>
  );
}
