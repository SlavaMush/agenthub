"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { AgentCard } from "./components/AgentCard";

const BOT_LINK = "https://t.me/tradr_aibot";
const BOT_API = process.env.NEXT_PUBLIC_BOT_API || "https://api.agenthub.gg";

// Small hydration-safe Reown AppKit connect button.
function ConnectWalletButton() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <div className="appkit-wrap">
      {mounted ? (
        <appkit-button />
      ) : (
        <button className="brand-button" disabled style={{ opacity: 0.4 }}>
          Connect Wallet
        </button>
      )}
    </div>
  );
}

// Inline dlegation setup component
import dynamic from "next/dynamic";
const StartInner = dynamic(
  () => import("@/app/start/page").then((m) => m.StartInner),
  { ssr: false }
);

// Onboarding flow status helper — hits /agent/status (cheap DB probe)
function useHasDelegate(address: string | undefined) {
  const [ready, setReady] = useState<boolean | null>(null);
  const [tick, setTick] = useState(0); // bump to re-probe
  useEffect(() => {
    if (!address) return;
    fetch(`${BOT_API}/agent/status`, { headers: { "X-Wallet-Address": address } })
      .then((r) => r.json())
      .then((j) => setReady(Boolean(j?.registered)))
      .catch(() => setReady(false));
  }, [address, tick]);
  return [ready, () => setTick((t) => t + 1)] as const;
}

export default function Home() {
  const { address, isConnected } = useAccount();
  const [delegateOk, refetchDelegate] = useHasDelegate(address);
  return (
    <main className="min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-text)]">
      {/* Top nav */}
      <nav className="sticky top-0 z-40 border-b border-[color:var(--color-border)] bg-[color:var(--color-bg)]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="/" className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-[color:var(--color-mint)] to-[color:var(--color-mint-dark)]" />
            <span className="text-sm font-semibold tracking-wide">AgentHub</span>
          </a>
          <div className="flex items-center gap-3 text-sm">
            <a href="#how" className="hidden text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)] sm:inline">
              How it works
            </a>
            <a href="#agents" className="hidden text-[color:var(--color-text-dim)] hover:text-[color:var(--color-text)] sm:inline">
              Agents
            </a>
            <a
              href="/start"
              className="text-[color:var(--color-mint)] hover:underline sm:inline"
            >
              Enable the agent
            </a>
            <a
              href={BOT_LINK}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-[color:var(--color-mint)]/40 bg-[color:var(--color-mint)]/10 px-3 py-1.5 text-xs font-medium text-[color:var(--color-mint)] hover:bg-[color:var(--color-mint)]/20"
            >
              Talk to Bot
            </a>
            <ConnectWalletButton />
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 md:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-mint)]">
            Agent network on Base
          </p>
          <h1 className="mt-4 text-balance text-4xl font-semibold leading-[1.1] md:text-6xl">
            Hire AI agents that{" "}
            <span className="brand-mint-text">actually trade.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-balance text-base leading-relaxed text-[color:var(--color-text-dim)] md:text-lg">
            Connect your wallet once. Speak plain language to an agent — here on this site or in
            Telegram. It opens and manages positions inside hard limits you set. Your funds never
            leave your wallet. You just delegate trades.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ConnectWalletButton />
            <a
              href={BOT_LINK}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-[color:var(--color-border-strong)] bg-transparent px-5 py-3 text-sm font-semibold text-[color:var(--color-text)] hover:border-[color:var(--color-mint)]/50 hover:bg-[color:var(--color-bg-raised)] sm:w-auto"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9.867 15.756 9.5 19.5c.486 0 .7-.208.953-.458l2.286-2.18 4.74 3.476c.87.48 1.49.228 1.724-.8l3.12-14.62c.28-1.3-.47-1.81-1.29-1.49L2.285 9.1c-1.28.5-1.265 1.215-.218 1.542l4.7 1.465L17.68 5.3c.513-.34.98-.153.596.187l-8.41 10.27Z"/>
              </svg>
              Chat on Telegram
            </a>
          </div>
          {isConnected && address && (
            <div className="mt-10">
              {delegateOk === null ? (
                <p className="text-sm text-[color:var(--color-text-mute)]">Checking delegate…</p>
              ) : delegateOk ? (
                <AgentCard address={address} />
              ) : (
                <div className="mx-auto max-w-xl text-left">
                  <StartInner onDone={refetchDelegate} />
                </div>
              )}
            </div>
          )}
          <p className="mt-6 text-xs text-[color:var(--color-text-mute)]">
            Self-custody. Revocable delegates. Settled on Base.
          </p>
        </div>
      </section>

      {/* Three pillars */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              t: "Plain-language trades",
              d: '"Long $100 ETH 5x with a 10% stop." The agent parses, prices, and opens it. No forms, no terminals.',
            },
            {
              t: "Hard guarantees",
              d: "Max leverage, per-trade cap, and daily loss limits are enforced on-chain before any order fires.",
            },
            {
              t: "Self-custody",
              d: "Agents sign with a delegate key your wallet creates. They can trade but can never touch principal.",
            },
          ].map((c) => (
            <div key={c.t} className="brand-card p-6">
              <div className="text-base font-semibold">{c.t}</div>
              <p className="mt-2 text-sm leading-relaxed text-[color:var(--color-text-dim)]">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-[color:var(--color-border)] bg-[color:var(--color-bg-raised)]/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-3xl font-semibold">How it works</h2>
          <div className="mt-10 grid gap-10 md:grid-cols-3">
            {[
              {
                n: "01",
                h: "Connect your wallet",
                p: "Open the Telegram bot or this site and link your Base wallet. Your address becomes your identity.",
              },
              {
                n: "02",
                h: "Sign one delegate permission",
                p: "A typed message from your wallet authorizes our bot key to execute trades bounded by your limits.",
              },
              {
                n: "03",
                h: "Chat, trade, walk away",
                p: "Talk in natural language. The agent reads, prices, and executes. You can pause, revoke, or close anytime.",
              },
            ].map((s) => (
              <div key={s.n}>
                <div className="font-mono text-sm text-[color:var(--color-mint)]">{s.n}</div>
                <div className="mt-3 text-lg font-semibold">{s.h}</div>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--color-text-dim)]">{s.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Agents section */}
      <section id="agents" className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-xs uppercase tracking-[0.08em] text-[color:var(--color-text-mute)]">
          Agents
        </div>
        <h2 className="mt-2 text-3xl font-semibold">One agent, zero maintenance</h2>
        <p className="mt-3 max-w-2xl text-sm text-[color:var(--color-text-dim)]">
          Our agent handles the boring parts: parse intents, enforce policies, execute trades on-chain.
          Solo custody, your rules.
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {/* Live agent card — Earn-app pattern */}
          <div className="brand-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-base font-semibold">AgentHub</div>
                <div className="mt-1 text-xs text-[color:var(--color-text-mute)]">
                  Natural-language perp trading
                </div>
              </div>
              <span className="pill pill-gain">
                <span className="status-dot" />
                Live
              </span>
            </div>
            <div className="mt-5 flex items-center justify-between text-xs">
              <div className="text-[color:var(--color-text-mute)]">Veranta perp, Base</div>
              <span className="pill pill-neutral">Trading</span>
            </div>
            <div className="mt-5 flex items-center justify-between">
              <div className="text-xs text-[color:var(--color-text-mute)]">via Telegram + Web</div>
              <a
                href={BOT_LINK}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-[color:var(--color-mint)] hover:underline"
              >
                Open agent →
              </a>
            </div>
          </div>

          {/* Coming soon — marketplace */}
          <div className="brand-card p-5 opacity-70">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-base font-semibold">Agent Marketplace</div>
                <div className="mt-1 text-xs text-[color:var(--color-text-mute)]">
                  Deploy your own. Get hired.
                </div>
              </div>
              <span className="pill pill-neutral">Coming Soon</span>
            </div>
            <p className="mt-5 text-sm text-[color:var(--color-text-dim)]">
              Publish an agent, set a price, earn per call in USDC via x402.
            </p>
            <ul className="mt-4 space-y-1 text-xs text-[color:var(--color-text-mute)]">
              <li>• Keep 80%. We take 20% platform fee.</li>
              <li>• Every trade paid out via x402.</li>
              <li>• Any agent: analytics, research, market-making.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section className="border-t border-[color:var(--color-border)] bg-[color:var(--color-bg-raised)]/40">
        <div className="mx-auto max-w-6xl px-6 py-16 text-center">
          <h2 className="text-3xl font-semibold">Ready to delegate?</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-[color:var(--color-text-dim)]">
            Open Telegram and tell the bot what you want. Sign once. Trade.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={BOT_LINK}
              target="_blank"
              rel="noreferrer"
              className="brand-button sm:w-auto"
              style={{ width: "auto", padding: "12px 28px" }}
            >
              Open Telegram
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[color:var(--color-border)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-[color:var(--color-text-mute)] sm:flex-row">
          <div>© AgentHub</div>
          <div>
            Powered by <span className="text-[color:var(--color-text-dim)]">Veranta</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
