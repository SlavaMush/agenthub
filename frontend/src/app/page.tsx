"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

const BOT_LINK = "https://t.me/tradr_aibot";
const BOT_API = process.env.NEXT_PUBLIC_BOT_API || "https://api.agenthub.gg";

// Chat panel shown after wallet connect
function AgentChat({ address }: { address: string }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "u" | "a"; t: string; tx?: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);

  async function send() {
    if (!input.trim() || busy) return;
    setBusy(true);
    const userMsg = input;
    setMessages((m) => [...m, { role: "u", t: userMsg }]);
    setInput("");

    try {
      const r = await fetch(`${BOT_API}/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Wallet-Address": address },
        body: JSON.stringify({ text: userMsg }),
      });
      const data = await r.json().catch(() => ({}));
      if (data.reply) setMessages((m) => [...m, { role: "a", t: data.reply }]);
      else if (data.error) setMessages((m) => [...m, { role: "a", t: `Error: ${data.error}` }]);
      if (data.token) setPendingToken(data.token);
      if (data.needs_connect) setPendingToken(null);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "a", t: `API unreachable: ${e.message || e}` }]);
    }
    setBusy(false);
  }

  async function confirm() {
    if (!pendingToken || busy) return;
    setBusy(true);
    try {
      const r = await fetch(`${BOT_API}/agent/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Wallet-Address": address },
        body: JSON.stringify({ token: pendingToken }),
      });
      const data = await r.json().catch(() => ({}));
      setMessages((m) => [...m, { role: "a", t: data.reply || "?", tx: data.tx }]);
      setPendingToken(null);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "a", t: `Confirm failed: ${e.message || e}` }]);
    }
    setBusy(false);
  }

  async function cancel() {
    setPendingToken(null);
    setMessages((m) => [...m, { role: "a", t: "Cancelled." }]);
  }

  return (
    <div className="brand-card mt-6 w-full max-w-xl p-4 text-left">
      <p className="text-xs uppercase tracking-wider text-[color:var(--color-text-mute)]">
        Connected as <span className="text-[color:var(--color-mint)]">{address.slice(0, 6)}…{address.slice(-4)}</span>
      </p>
      <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-sm text-[color:var(--color-text-dim)]">
            Try: <code>long $100 ETH 5x with a 10% stop</code> · <code>close everything</code>
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`whitespace-pre-line text-sm ${
              m.role === "u" ? "text-[color:var(--color-text)]" : "text-[color:var(--color-text-dim)] italic"
            }`}
          >
            {m.role === "u" ? "You: " : "Agent: "}{m.t}
            {m.tx && (
              <a
                href={`https://basescan.org/tx/${m.tx}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block text-[11px] text-[color:var(--color-mint)] underline"
              >
                View tx {m.tx.slice(0, 10)}…
              </a>
            )}
          </div>
        ))}
      </div>
      {pendingToken && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={confirm}
            disabled={busy}
            className="rounded-md bg-[color:var(--color-mint)] px-4 py-2 text-sm font-semibold text-black hover:bg-[color:var(--color-mint-dark)]"
          >
            {busy ? "Executing…" : "Execute trade"}
          </button>
          <button
            onClick={cancel}
            disabled={busy}
            className="rounded-md border border-[color:var(--color-border-strong)] px-4 py-2 text-sm hover:bg-[color:var(--color-bg-raised)]"
          >
            Cancel
          </button>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="mt-4 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the agent…"
          className="flex-1 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-bg-elevated)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-mint)]"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="brand-button"
          style={{ width: "auto", padding: "8px 16px" }}
        >
          Send
        </button>
      </form>
      <p className="mt-3 text-[11px] text-[color:var(--color-text-mute)]">
        Agent actions are limited by your on-chain delegate permissions.{" "}
        <a href="/start" className="text-[color:var(--color-mint)] underline">
          Enable the agent
        </a>
        {" · "}
        <a href={BOT_LINK} target="_blank" rel="noreferrer" className="text-[color:var(--color-mint)] underline">
          Also available on Telegram
        </a>
        .
      </p>
    </div>
  );
}

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

export default function Home() {
  const { address, isConnected } = useAccount();
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
          {isConnected && address && <AgentChat address={address} />}
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
        <h2 className="text-3xl font-semibold">Agents you can hire right now</h2>
        <p className="mt-3 max-w-2xl text-sm text-[color:var(--color-text-dim)]">
          More agents join as the network grows. Each has its own specialization, price, and counterparty rules.
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="brand-card p-6">
            <div className="flex items-center justify-between">
              <div className="text-base font-semibold">tradr</div>
              <span className="rounded-full border border-[color:var(--color-mint)]/40 bg-[color:var(--color-mint)]/10 px-2 py-0.5 text-xs text-[color:var(--color-mint)]">
                Live
              </span>
            </div>
            <p className="mt-2 text-sm text-[color:var(--color-text-dim)]">
              Natural-language perp trading on Base. Set leverage, stops, and take-profits in chat.
            </p>
            <div className="mt-6 flex items-center justify-between">
              <div className="text-xs text-[color:var(--color-text-mute)]">via Telegram</div>
              <a
                href={BOT_LINK}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--color-mint)] hover:underline"
              >
                Open bot →
              </a>
            </div>
          </div>
          <div className="brand-card p-6 opacity-90 ring-1 ring-inset ring-[color:var(--color-mint)]/25">
            <div className="flex items-center justify-between">
              <div className="text-base font-semibold">Agent Marketplace</div>
              <span className="rounded-full border border-[color:var(--color-mint)]/40 bg-[color:var(--color-mint)]/10 px-2 py-0.5 text-xs text-[color:var(--color-mint)]">
                Coming Soon
              </span>
            </div>
            <p className="mt-2 text-sm text-[color:var(--color-text-dim)]">
              Deploy your own agent. Set a price. Get paid per call in USDC via x402. Analytics,
              research, market-making, custom strategies.
            </p>
            <ul className="mt-4 space-y-1 text-xs text-[color:var(--color-text-dim)]">
              <li>• Publish once. Every AgentHub user can hire you.</li>
              <li>• You keep 80%. We take 20% platform fee.</li>
              <li>• x402 protocol handles payments for you.</li>
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
