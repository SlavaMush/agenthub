// Earn-app style agent detail: hero balance, perf pill, action bar, tabs, positions/chat
"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";

const BOT_API = process.env.NEXT_PUBLIC_BOT_API || "https://api.agenthub.gg";

type Tab = "chat" | "positions" | "activity" | "rules";

export function AgentCard({ address }: { address: string }) {
  const [tab, setTab] = useState<Tab>("chat");
  const [positions, setPositions] = useState<null | { items: any[]; err?: string }>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Derived stats (computed from positions for now; v2 pulls from API)
  const stats = useMemo(() => {
    if (!positions?.items?.length) {
      return { total: 0, n_pnl: 0, n_pct: 0, n_positions: 0, paused: false };
    }
    const total = positions.items.reduce((a, p: any) => a + (Number(p?.collateral) || 0), 0);
    const n_positions = positions.items.length;
    return { total, n_pnl: 0, n_pct: 0, n_positions, paused: false };
  }, [positions]);

  async function fetchPositions() {
    setRefreshing(true);
    try {
      const r = await fetch(`${BOT_API}/agent/positions`, {
        headers: { "X-Wallet-Address": address },
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) setPositions({ items: data.positions || [] });
      else setPositions({ items: [], err: data.error || `status ${r.status}` });
    } catch (e: any) {
      setPositions({ items: [], err: e.message || String(e) });
    }
    setRefreshing(false);
  }

  useEffect(() => {
    fetchPositions();
  }, [address]);

  const isProfit = stats.n_pnl >= 0;

  return (
    <div className="mx-auto w-full max-w-2xl text-left">
      {/* Header — title + wallet subtitle + status */}
      <div className="mt-2 mb-6 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.08em] text-[color:var(--color-text-mute)]">
            Agent
          </div>
          <div className="mt-1 text-xl font-semibold">Avantis Alpha</div>
          <div className="mt-1 font-mono text-xs text-[color:var(--color-text-dim)]">
            {address.slice(0, 6)}…{address.slice(-4)}
          </div>
        </div>
        <div className="pill pill-gain">
          <span className="status-dot" />
          <span>Live</span>
        </div>
      </div>

      {/* Hero balance */}
      <div className="brand-card p-6">
        <div className="text-xs uppercase tracking-[0.08em] text-[color:var(--color-text-mute)]">
          Total collateral
        </div>
        <div className="mt-2 balance-xl">${stats.total.toFixed(2)}</div>
        <div className="mt-3 inline-flex items-center gap-2">
          <span className={`pill ${isProfit ? "pill-gain" : "pill-loss"}`}>
            {isProfit ? "+" : "−"}${Math.abs(stats.n_pnl).toFixed(2)} ({isProfit ? "+" : "−"}
            {Math.abs(stats.n_pct).toFixed(1)}%)
          </span>
          <span className="text-[11px] uppercase tracking-wider text-[color:var(--color-text-mute)]">
            Since funding
          </span>
        </div>
      </div>

      {/* Action bar */}
      <div className="mt-4 action-bar">
        <button onClick={() => setTab("chat")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z" />
          </svg>
          Chat
        </button>
        <button onClick={() => setTab("positions")} disabled={refreshing}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 3v18h18" />
            <path d="m7 13 4-6 4 3 5-7" />
          </svg>
          {refreshing ? "... " : ""}Positions
        </button>
        <button onClick={() => setTab("rules")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.3a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.3a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.3a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Rules
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-6 tab-bar">
        {(
          [
            ["chat", "Chat"],
            ["positions", "Positions"],
            ["activity", "Activity"],
            ["rules", "Rules"],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={tab === k ? "active" : undefined}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-4">
        {tab === "chat" && <AgentChat address={address} />}
        {tab === "positions" && (
          <PositionsPane positions={positions} refreshing={refreshing} onRefresh={fetchPositions} />
        )}
        {tab === "activity" && <ActivityPane />}
        {tab === "rules" && <RulesPane address={address} />}
      </div>

      {/* Bottom note */}
      <p className="mt-8 text-center text-xs text-[color:var(--color-text-mute)]">
        Self-custody. Agent can trade but cannot withdraw principal.{" "}
        <a
          href="https://t.me/tradr_aibot"
          target="_blank"
          rel="noreferrer"
          className="text-[color:var(--color-text-dim)] underline"
        >
          Telegram bot
        </a>
        .
      </p>
    </div>
  );
}

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
      setMessages((m) => [...m, { role: "a", t: data.reply || "?" , tx: data.tx }]);
      setPendingToken(null);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "a", t: `Confirm failed: ${e.message || e}` }]);
    }
    setBusy(false);
  }

  return (
    <div className="brand-card p-4 text-left">
      <div className="flex min-h-[180px] max-h-[320px] flex-col gap-3 overflow-y-auto">
        {messages.length === 0 && (
          <div className="text-sm leading-relaxed text-[color:var(--color-text-dim)]">
            <p className="mb-2">Talk in plain English. Examples:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li><code>long $100 ETH 5x with a 10% stop</code></li>
              <li><code>close my ETH</code></li>
              <li><code>close everything</code></li>
            </ul>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "u" ? "self-end" : "self-start max-w-[88%]"}>
            <div
              className={`rounded-xl px-3 py-2 text-sm ${
                m.role === "u"
                  ? "bg-[color:var(--color-bg-pill)] text-[color:var(--color-text)]"
                  : "bg-transparent text-[color:var(--color-text-dim)]"
              }`}
            >
              <span className="whitespace-pre-line">{m.t}</span>
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
          </div>
        ))}
      </div>
      {pendingToken && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={confirm}
            disabled={busy}
            className="rounded-md bg-[color:var(--color-gain)] px-4 py-2 text-sm font-semibold text-black hover:brightness-110"
          >
            Execute
          </button>
          <button
            onClick={() => { setPendingToken(null); setMessages((m) => [...m, { role: "a", t: "Cancelled." }]); }}
            disabled={busy}
            className="rounded-md border border-[color:var(--color-border-strong)] px-4 py-2 text-sm hover:bg-[color:var(--color-bg-raised)]"
          >
            Cancel
          </button>
        </div>
      )}
      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="mt-3 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="long $100 ETH 5x"
          disabled={busy}
          className="flex-1 rounded-md border border-[color:var(--color-border)] bg-transparent px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-mint)]/50"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-md bg-[color:var(--color-mint)] px-4 py-2.5 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}

function PositionsPane({
  positions,
  refreshing,
  onRefresh,
}: {
  positions: { items: any[]; err?: string } | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="brand-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="brand-label">Open positions</div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="text-xs text-[color:var(--color-mint)] hover:underline"
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      {!positions ? (
        <div className="py-6 text-center text-sm text-[color:var(--color-text-mute)]">Loading…</div>
      ) : positions.err ? (
        <div className="py-4 text-sm text-[color:var(--color-loss)]">{positions.err}</div>
      ) : positions.items.length === 0 ? (
        <div className="py-6 text-center text-sm text-[color:var(--color-text-dim)]">
          No open positions. Start with the Chat tab.
        </div>
      ) : (
        <ul className="divide-y divide-[color:var(--color-border)]">
          {positions.items.map((p: any, i: number) => (
            <li key={i} className="flex items-center justify-between py-3">
              <div>
                <div className="font-mono text-sm">{p.symbol || p.market || "?"}</div>
                <div className="text-[11px] text-[color:var(--color-text-mute)]">
                  {p.side} · {p.leverage || "1"}x
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm">${Number(p.collateral || 0).toFixed(2)}</div>
                <div className={`text-[11px] ${(p.pnl || 0) >= 0 ? "text-[color:var(--color-gain)]" : "text-[color:var(--color-loss)]"}`}>
                  {(p.pnl || 0) >= 0 ? "+" : ""}{Number(p.pnl || 0).toFixed(2)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ActivityPane() {
  return (
    <div className="brand-card p-4">
      <div className="brand-label">Activity</div>
      <div className="py-6 text-center text-sm text-[color:var(--color-text-dim)]">
        Trades and events will show up here as they happen.
      </div>
      <div className="report-card">
        <div>
          <div className="text-sm font-semibold">Daily report</div>
          <div className="text-xs text-[color:var(--color-text-dim)]">
            A summary letter once every 24h
          </div>
        </div>
        <div className="text-xs text-[color:var(--color-text-mute)]">Coming soon</div>
      </div>
    </div>
  );
}

function RulesPane({ address }: { address: string }) {
  const [rules, setRules] = useState<string | null>(null);

  useEffect(() => {
    // Default local presentation — current policy is enforced server-side.
    // TODO: wire /agent/policy endpoint to actually show user-configured caps.
    setRules(
      `Max leverage: 5x
Per-trade notional: $500 USDC
Daily volume cap: $1,000 USDC
Max open positions: 3
Daily loss floor: $500 USDC
Protocol minimum: $100 USDC notional per trade`
    );
  }, [address]);

  return (
    <div className="brand-card p-4">
      <div className="brand-label">Delegate permissions</div>
      {rules ? (
        <pre className="mt-3 whitespace-pre-wrap font-mono text-sm leading-relaxed text-[color:var(--color-text-dim)]">
          {rules}
        </pre>
      ) : (
        <div className="py-4 text-sm text-[color:var(--color-text-mute)]">Loading…</div>
      )}
      <p className="mt-4 text-[11px] text-[color:var(--color-text-mute)]">
        Rules are enforced on-chain. You can update them via Telegram bot by messaging
        <span className="mx-1 text-[color:var(--color-text-dim)]">@tradr_aibot</span>
        with <code>max X</code>, <code>lev Y</code>, <code>size Z</code>.
      </p>
    </div>
  );
}
