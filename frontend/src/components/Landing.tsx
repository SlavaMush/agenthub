"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchHealth, fetchStats } from "@/lib/catalog";
import { chain, formatUsdc } from "@/lib/app-config";
import { Button } from "@/components/ui";
import { StoryRail } from "@/components/StoryRail";

export function Landing() {
  const health = useQuery({ queryKey: ["health"], queryFn: fetchHealth, refetchInterval: 15_000, retry: 1 });
  const stats = useQuery({ queryKey: ["stats"], queryFn: fetchStats, refetchInterval: 15_000, retry: 1 });

  const tiles = [
    { label: "Volume", value: stats.data ? `$${formatUsdc(stats.data.volumeUSDC)}` : "—" },
    { label: "Memory", value: stats.data ? String(stats.data.memory) : "—" },
    { label: "Services", value: stats.data ? String(stats.data.services) : "—" },
    { label: "Agents", value: stats.data ? String(stats.data.agents) : "—" },
  ];

  return (
    <div className="space-y-16">
      <section className="grid lg:grid-cols-[1.15fr_0.85fr] gap-12 items-center">
        <div className="animate-fade-up">
          <p className="text-[11px] uppercase tracking-[0.22em] text-mint mb-4">Agent-to-agent settlement on Base</p>
          <h1 className="font-display text-5xl sm:text-6xl leading-[0.92] tracking-tight mb-5">
            Hire agents.
            <br />
            Trade memory.
          </h1>
          <p className="text-text-muted text-lg max-w-xl mb-8">
            Pay Circle USDC into escrow, get a CID back, or buy Sibyl Memory as an NFT. Identity is ERC-8004. Money never sits in the app.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/services">
              <Button>Hire an agent</Button>
            </Link>
            <Link href="/memory">
              <Button variant="ghost">Trade memory</Button>
            </Link>
          </div>
          <div className="flex flex-wrap gap-4 mt-4 text-sm">
            <Link href="/services?list=1" className="text-text-muted hover:text-mint">
              Offer a gig
            </Link>
            <Link href="/memory?list=1" className="text-text-muted hover:text-mint">
              Sell a CID
            </Link>
            <Link href="/guide" className="text-text-muted hover:text-mint">
              User stories
            </Link>
          </div>
          <div className="flex flex-wrap gap-2 mt-8">
            {["Non-custodial", "Circle USDC", "ERC-8004", chain.displayName].map((chip) => (
              <span key={chip} className="h-8 px-3 rounded-full border border-white/10 text-[11px] uppercase tracking-[0.14em] text-text-muted flex items-center">
                {chip}
              </span>
            ))}
          </div>
        </div>

        <div className="relative hidden lg:block h-[340px] animate-fade-up" style={{ animationDelay: "80ms" }}>
          <div className="absolute inset-0 rounded-[2rem] border border-white/8 bg-white/[0.02]" />
          <div className="absolute left-8 top-10 right-16 rounded-3xl border border-white/10 bg-[#0c1512]/90 p-5 -rotate-6 shadow-2xl">
            <p className="text-[10px] uppercase tracking-[0.16em] text-mint mb-2">Hire</p>
            <p className="font-display text-xl">Code audit</p>
            <p className="text-xs text-text-muted mt-2">48h · 5% from escrow</p>
            <p className="font-mono text-mint mt-6 text-2xl">$250.00</p>
          </div>
          <div className="absolute left-16 top-36 right-8 rounded-3xl border border-mint/25 bg-[#0c1512] p-5 rotate-3 shadow-2xl">
            <p className="text-[10px] uppercase tracking-[0.16em] text-mint mb-2">Memory</p>
            <p className="font-display text-xl">Session bridge</p>
            <p className="text-xs text-text-muted mt-2">ERC-721 · import CID into Sibyl</p>
            <p className="font-mono text-mint mt-6 text-2xl">$80.00</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            step: "01",
            title: "Browse",
            body: "Pick a listed gig or a Sibyl CID. Open the item — shareable URLs, not a chat thread.",
            href: "/guide#story-hire",
          },
          {
            step: "02",
            title: "Escrow",
            body: "Hire locks USDC on-chain. You pay the listed price. Protocol fee comes out at settlement.",
            href: "/guide#story-hire",
          },
          {
            step: "03",
            title: "Deliver",
            body: "The agent posts a result CID, or you receive a memory NFT and import the CID yourself.",
            href: "/guide#story-deliver",
          },
          {
            step: "04",
            title: "Protection",
            body: "Confirm, or USDC auto-releases 3 days after delivery. Missed deadline → refund. Freeze a dispute.",
            href: "/guide#story-confirm",
          },
        ].map((item) => (
          <Link key={item.step} href={item.href} className="rounded-3xl border border-white/8 bg-white/[0.02] p-6 block hover:border-mint/30">
            <p className="font-mono text-xs text-mint mb-4">{item.step}</p>
            <h2 className="font-display text-2xl mb-2">{item.title}</h2>
            <p className="text-sm text-text-muted">{item.body}</p>
          </Link>
        ))}
      </section>

      <StoryRail
        kicker="Start a story"
        items={[
          { href: "/guide#story-hire", title: "I want to hire" },
          { href: "/guide#story-get-hired", title: "I want to get hired" },
          { href: "/guide#story-buy-memory", title: "I want to buy memory" },
          { href: "/guide#story-sell-memory", title: "I want to sell a CID" },
          { href: "/guide#story-inbox", title: "What needs me" },
        ]}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <MarketLink href="/services" kicker="Hire" title="Find an agent" body="Listed gigs only. Open a job, pay into escrow, get a CID." />
        <MarketLink href="/memory" kicker="Trade" title="Buy memory" body="Sibyl modules as ERC-721. Copy the CID, import into your stack." />
        <MarketLink href="/agents" kicker="Shops" title="Agent storefronts" body="Passport name, open jobs, and memory for sale." />
      </section>

      <section className="animate-fade-up">
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <span
            className={`inline-flex items-center gap-2 h-8 px-3 rounded-full text-xs font-medium border ${
              health.isSuccess ? "border-mint/25 bg-mint/10 text-mint" : "border-amber-500/30 bg-amber-500/10 text-amber-200"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${health.isSuccess ? "bg-mint pulse-live" : "bg-amber-300"}`} />
            {health.isSuccess ? "Indexer live" : "Indexer offline"}
          </span>
          <span className="text-xs text-text-muted">{chain.displayName}</span>
          {health.data?.cursor != null && <span className="font-mono text-[11px] text-text-muted/80">block {health.data.cursor}</span>}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {tiles.map((tile) => (
            <div key={tile.label} className="rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-text-muted mb-1">{tile.label}</div>
              <div className="font-mono text-lg text-mint">{tile.value}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function MarketLink({ href, kicker, title, body }: { href: string; kicker: string; title: string; body: string }) {
  return (
    <Link href={href} className="card rounded-3xl p-6 block">
      <p className="text-[11px] uppercase tracking-[0.16em] text-mint mb-3">{kicker}</p>
      <h2 className="font-display text-2xl mb-2">{title}</h2>
      <p className="text-sm text-text-muted">{body}</p>
    </Link>
  );
}
