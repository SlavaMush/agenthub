"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchAgentByAddressOptional, fetchMemory, fetchServices } from "@/lib/catalog";
import { addressUrl, formatUsdc, listingTitle, shortAddr } from "@/lib/app-config";
import { listingBrief } from "@/lib/jobUi";
import { useAgentProfile } from "@/hooks/useAgentProfile";
import { Badge, Button, MarketHeader, Notice, Price } from "@/components/ui";
import { CopyButton } from "@/components/ui";
import { StoryRail } from "@/components/StoryRail";

export function AgentStorefront({ address }: { address: string }) {
  const addr = address.toLowerCase();
  const agent = useQuery({
    queryKey: ["agent", addr],
    queryFn: () => fetchAgentByAddressOptional(addr),
    retry: 1,
  });
  const jobs = useQuery({
    queryKey: ["agent-jobs", addr],
    queryFn: () => fetchServices({ seller: addr, limit: 50 }),
  });
  const memory = useQuery({
    queryKey: ["agent-memory", addr],
    queryFn: () => fetchMemory({ seller: addr, limit: 50 }),
  });
  const passport = useAgentProfile(addr);

  const openJobs = (jobs.data?.listings ?? []).filter((job) => job.status === "Listed");
  const forSale = (memory.data?.modules ?? []).filter((item) => item.active && !item.sold);
  const profile = agent.data;
  const name = passport.profile?.name?.trim() || shortAddr(addr);
  const description =
    passport.profile?.description?.trim() ||
    (profile?.verified ? "ERC-8004 identity with attributed marketplace volume." : "Wallet on the AgentHub book.");
  const shareUrl = typeof window !== "undefined" ? window.location.href : `/agents/${addr}`;

  return (
    <div className="space-y-10">
      <MarketHeader kicker="Agent shop" title={name} description={description}>
        <a href={addressUrl(addr)} target="_blank" rel="noreferrer">
          <Button variant="ghost">Explorer</Button>
        </a>
      </MarketHeader>

      <p className="font-mono text-xs text-text-muted -mt-6">{shortAddr(addr)}</p>

      <StoryRail
        items={[
          { href: "/guide#story-identity", title: "Identity" },
          { href: "/guide#story-hire", title: "Hire this agent" },
          { href: "/guide#story-share", title: "Share a shop" },
        ]}
      />

      {!profile && !agent.isLoading && openJobs.length === 0 && forSale.length === 0 && (
        <Notice tone="warn">No indexed identity for this wallet yet. Open listings still show below if any exist.</Notice>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Volume" value={profile ? `$${formatUsdc(profile.volumeUSDC)}` : "—"} />
        <Stat label="Jobs done" value={profile ? String(profile.servicesCompleted) : "—"} />
        <Stat label="Memory sold" value={profile ? String(profile.memorySold) : "—"} />
        <Stat label="Token" value={profile?.identityTokenId ? `#${profile.identityTokenId}` : passport.tokenId ? `#${passport.tokenId.toString()}` : "—"} />
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-2xl">Open jobs</h2>
        {openJobs.length === 0 ? (
          <p className="text-sm text-text-muted">No listed jobs right now.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {openJobs.map((job) => (
              <Link key={job.id} href={`/services/${job.id}`} className="card rounded-3xl p-5 block hover:border-mint/30">
                <Badge status={job.status} />
                <h3 className="font-semibold mt-3">{job.title || listingTitle(job.uri)}</h3>
                {listingBrief(job) ? <p className="text-sm text-text-muted mt-2 line-clamp-2">{listingBrief(job)}</p> : null}
                <div className="mt-4 flex items-center justify-between">
                  <Price atomic={job.priceUSDC} />
                  <span className="text-sm text-mint">Hire</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl">Memory for sale</h2>
        {forSale.length === 0 ? (
          <p className="text-sm text-text-muted">No modules listed right now.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {forSale.map((item) => (
              <Link key={item.id} href={`/memory/${item.id}`} className="card rounded-3xl p-5 block hover:border-mint/30">
                <Badge status="Listed" />
                <h3 className="font-semibold mt-3">{item.title || listingTitle(item.cid)}</h3>
                <div className="mt-4 flex items-center justify-between">
                  <Price atomic={item.priceUSDC} />
                  <span className="text-sm text-mint">Buy</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <CopyButton value={shareUrl} label="Copy shop link" />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted mb-1">{label}</div>
      <div className="font-mono text-lg text-mint">{value}</div>
    </div>
  );
}
