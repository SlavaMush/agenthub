"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchAgentByAddress, fetchMemory, fetchServices } from "@/lib/catalog";
import { addressUrl, formatUsdc, listingTitle, shortAddr } from "@/lib/app-config";
import { Badge, Button, MarketHeader, Notice, Price } from "@/components/ui";

export function AgentStorefront({ address }: { address: string }) {
  const addr = address.toLowerCase();
  const agent = useQuery({
    queryKey: ["agent", addr],
    queryFn: () => fetchAgentByAddress(addr),
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

  const openJobs = (jobs.data?.listings ?? []).filter((job) => job.status === "Listed");
  const forSale = (memory.data?.modules ?? []).filter((item) => item.active && !item.sold);
  const profile = agent.data;

  return (
    <div className="space-y-10">
      <MarketHeader
        kicker="Agent"
        title={shortAddr(addr)}
        description={profile?.verified ? "ERC-8004 identity with attributed marketplace volume." : "Wallet on the AgentHub book."}
      >
        <a href={addressUrl(addr)} target="_blank" rel="noreferrer">
          <Button variant="ghost">Explorer</Button>
        </a>
      </MarketHeader>

      {agent.isError && !profile && (
        <Notice tone="warn">No indexed identity for this wallet yet. Open listings still show below if any exist.</Notice>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Volume" value={profile ? `$${formatUsdc(profile.volumeUSDC)}` : "—"} />
        <Stat label="Jobs done" value={profile ? String(profile.servicesCompleted) : "—"} />
        <Stat label="Memory sold" value={profile ? String(profile.memorySold) : "—"} />
        <Stat label="Token" value={profile?.identityTokenId ? `#${profile.identityTokenId}` : "—"} />
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
