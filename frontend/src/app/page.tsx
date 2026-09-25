"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useConfig, useSignMessage, useSignTypedData, useSwitchChain, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { erc20Abi, parseUnits } from "viem";
import { base } from "@reown/appkit/networks";

const API = process.env.NEXT_PUBLIC_BOT_API || "https://api.agenthub.gg";
const BOT = "https://t.me/tradr_aibot";
const LIMITS = [
  ["max_leverage", "Max leverage (x)"],
  ["max_collateral", "Collateral per trade ($)"],
  ["max_daily_notional", "Size per day ($)"],
  ["max_positions", "Open positions"],
  ["max_daily_loss", "Daily loss limit ($)"],
] as const;

type Hex = `0x${string}`;
type Policy = Record<(typeof LIMITS)[number][0], number>;
type Position = { pair: string; side: string; collateral: number; leverage: number; entry: number; liq: number; pnl: number };
type Me = {
  wallet: string; active: boolean; expires: number; paused: boolean; telegram: boolean; policy: Policy;
  usdc?: Hex; balance?: number; approvals?: { spender: Hex; allowance: number }[]; positions?: Position[];
};
type Run = (label: string, fn: (step: (label: string) => void) => Promise<void>) => Promise<void>;

const storage = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string | null) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} },
};

class ApiError extends Error { constructor(msg: string, public status: number) { super(msg); } }

async function api<T = any>(path: string, token: string | null, body?: object): Promise<T> {
  const r = await fetch(API + path, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body && JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(j.error || `Request failed (${r.status})`, r.status);
  return j;
}

const errText = (e: any) => e?.shortMessage || e?.message || String(e);
const card = "rounded-2xl border border-line bg-card p-5";
const btn = "w-full rounded-xl bg-mint px-5 py-3 font-semibold text-black transition hover:brightness-110 disabled:opacity-50";
const ghost = "rounded-lg border border-line px-3 py-2 text-sm text-dim hover:text-white disabled:opacity-50";

export default function Home() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const key = `agenthub:${address?.toLowerCase()}`;

  useEffect(() => { setMe(null); setErr(""); setToken(address ? storage.get(key) : null); }, [address, key]);

  const refresh = useCallback(async () => {
    if (!token) return;
    try { setMe(await api<Me>("/api/me", token)); }
    catch (e) { if (e instanceof ApiError && e.status === 401) { storage.set(key, null); setToken(null); } else setErr(errText(e)); }
  }, [token, key]);
  useEffect(() => { refresh(); }, [refresh]);

  const run: Run = async (label, fn) => {
    setBusy(label); setErr("");
    try { await fn(setBusy); } catch (e) { setErr(errText(e)); } finally { setBusy(""); }
  };

  const signIn = () => run("Confirm the sign-in in your wallet…", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const signature = await signMessageAsync({ message: `Sign in to AgentHub\nWallet: ${address}\nIssued: ${ts}` });
    const tg = new URLSearchParams(location.search).get("tg") || undefined;
    const r = await api("/api/login", null, { wallet: address, ts, signature, tg });
    if (tg) history.replaceState(null, "", "/");
    storage.set(key, r.token);
    setToken(r.token);
  });

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 pb-10">
      <nav className="flex items-center justify-between gap-3 py-4">
        <a href="/" className="flex items-center gap-2 font-semibold">
          <span className="h-6 w-6 rounded-md bg-gradient-to-br from-mint to-gain" /> AgentHub
        </a>
        <appkit-button balance="hide" />
      </nav>

      {!isConnected ? <Hero /> : !token ? (
        <section className={`${card} mt-6 space-y-3`}>
          <h2 className="text-xl font-semibold">Sign in</h2>
          <p className="text-sm text-dim">One free signature proves you own this wallet. No transaction, no gas.</p>
          <button className={btn} disabled={!!busy} onClick={signIn}>{busy || "Sign in with wallet"}</button>
        </section>
      ) : !me ? <p className="mt-10 text-center text-sm text-dim">Loading your account…</p>
        : me.active ? <Dashboard me={me} token={token} run={run} busy={busy} refresh={refresh} />
        : <Setup me={me} token={token} run={run} busy={busy} refresh={refresh} />}

      {err && <p className="mt-4 whitespace-pre-line break-words rounded-xl bg-loss/10 p-3 text-sm text-loss">{err}</p>}
      <footer className="mt-auto pt-10 text-center text-xs text-mute">
        Self-custody on Base · trades via <a className="underline" href="https://www.veranta.xyz">Veranta</a> ·{" "}
        <a className="underline" href={BOT}>Telegram bot</a>
      </footer>
    </main>
  );
}

function Hero() {
  return (
    <section className="py-12 text-center sm:py-20">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mint">Perp trading agent on Base</p>
      <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">Trade in plain English.</h1>
      <p className="mx-auto mt-5 max-w-md text-dim">
        “Long $20 ETH 5x with a 5% stop.” The agent quotes it, checks your limits, and executes after you confirm,
        here or in Telegram. Funds never leave your wallet.
      </p>
      <div className="mx-auto mt-8 flex max-w-xs flex-col items-center gap-3">
        <appkit-button label="Connect wallet" />
        <a href={BOT} className="text-sm text-mint underline">or open the Telegram bot</a>
      </div>
      <ul className="mx-auto mt-12 grid max-w-xl gap-3 text-left text-sm text-dim sm:grid-cols-3">
        <li className={card}><b className="text-white">Hard limits.</b> Leverage, size, daily volume and loss caps are checked before every order.</li>
        <li className={card}><b className="text-white">Revocable.</b> A 30-day trading key that can never withdraw or move funds.</li>
        <li className={card}><b className="text-white">Gasless.</b> One signature to enable. Orders are relayed for you.</li>
      </ul>
    </section>
  );
}

type Props = { me: Me; token: string; run: Run; busy: string; refresh: () => Promise<void> };

function useDelegate({ token, run, refresh }: Props) {
  const { signTypedDataAsync } = useSignTypedData();
  return (policy?: Policy) => run("Preparing…", async (step) => {
    if (policy) await api("/api/policy", token, policy);
    const typed = await api("/api/delegate/prepare", token, {});
    step("Sign the delegation in your wallet…");
    const signature = await signTypedDataAsync(typed);
    step("Registering on-chain…");
    await api("/api/delegate/submit", token, { signature });
    await refresh();
  });
}

function Limits({ value, onChange }: { value: Policy; onChange: (p: Policy) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {LIMITS.map(([k, label]) => (
        <label key={k} className="text-xs text-mute">
          {label}
          <input type="number" inputMode="decimal" min={1} value={value[k] ?? ""}
            onChange={(e) => onChange({ ...value, [k]: Number(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-line bg-black px-3 py-2 text-base text-white outline-none focus:border-mint" />
        </label>
      ))}
    </div>
  );
}

function Setup(props: Props) {
  const [policy, setPolicy] = useState(props.me.policy);
  const delegate = useDelegate(props);
  return (
    <section className={`${card} mt-6 space-y-4`}>
      <h2 className="text-xl font-semibold">Enable the agent</h2>
      <p className="text-sm text-dim">
        Set your limits, then sign one delegation. It lets the agent trade for 30 days and can never move funds.
        Markets need at least $100 size (collateral × leverage).
      </p>
      <Limits value={policy} onChange={setPolicy} />
      <button className={btn} disabled={!!props.busy} onClick={() => delegate(policy)}>{props.busy || "Sign delegation"}</button>
    </section>
  );
}

function Dashboard(props: Props) {
  const { me, token, run, busy, refresh } = props;
  const [policy, setPolicy] = useState(me.policy);
  const delegate = useDelegate(props);
  const daysLeft = Math.max(0, Math.floor((me.expires - Date.now() / 1000) / 86400));
  return (
    <div className="mt-4 space-y-4">
      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs uppercase tracking-wider text-mute">Wallet USDC</span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${me.paused ? "bg-loss/10 text-loss" : "bg-gain/10 text-gain"}`}>
            {me.paused ? "Paused" : "Active"} · key valid {daysLeft}d
          </span>
        </div>
        <div className="mt-2 text-4xl font-bold tabular-nums">{me.balance === undefined ? "—" : `$${me.balance.toFixed(2)}`}</div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className={ghost} disabled={!!busy} onClick={() => run("Saving…", async () => { await api("/api/policy", token, { paused: !me.paused }); await refresh(); })}>
            {me.paused ? "Resume trading" : "Pause trading"}
          </button>
          <button className={ghost} disabled={!!busy} onClick={refresh}>Refresh</button>
          {daysLeft < 7 && <button className={ghost} disabled={!!busy} onClick={() => delegate()}>Renew key</button>}
          {!me.telegram && <a className={ghost} href={BOT}>Link Telegram</a>}
        </div>
      </section>
      <Approve {...props} />
      <Chat {...props} />
      <section className={card}>
        <h3 className="mb-3 font-semibold">Positions</h3>
        {!me.positions?.length ? <p className="text-sm text-dim">No open positions.</p> : me.positions.map((p, i) => (
          <div key={i} className="flex flex-wrap justify-between gap-x-4 border-t border-line py-2 text-sm first:border-0">
            <span><b className={p.side === "long" ? "text-gain" : "text-loss"}>{p.side}</b> {p.pair} {p.leverage}x · ${p.collateral}</span>
            <span className="tabular-nums text-dim">
              @ {p.entry.toLocaleString()} · liq {p.liq.toLocaleString()} · <span className={p.pnl < 0 ? "text-loss" : "text-gain"}>{p.pnl >= 0 ? "+" : ""}{p.pnl}</span>
            </span>
          </div>
        ))}
      </section>
      <section className={`${card} space-y-4`}>
        <h3 className="font-semibold">Limits</h3>
        <Limits value={policy} onChange={setPolicy} />
        <button className={btn} disabled={!!busy} onClick={() => run("Saving…", async () => { await api("/api/policy", token, policy); await refresh(); })}>
          Save limits
        </button>
      </section>
    </div>
  );
}

function Approve({ me, run, busy, refresh }: Props) {
  const config = useConfig();
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [amount, setAmount] = useState(String(Math.max(100, Math.ceil(me.balance || 0))));
  const needed = (me.approvals || []).filter((a) => a.allowance < Math.min(Number(amount) || 1, me.balance || 1));
  if (!me.usdc || !needed.length) return null;
  const approve = () => run("Switching to Base…", async (step) => {
    if (chainId !== base.id) await switchChainAsync({ chainId: base.id });
    for (const [i, a] of needed.entries()) {
      step(`Approve ${i + 1} of ${needed.length} in your wallet…`);
      const hash = await writeContractAsync({ address: me.usdc!, abi: erc20Abi, functionName: "approve",
        args: [a.spender, parseUnits(amount, 6)], chainId: base.id });
      await waitForTransactionReceipt(config, { hash, chainId: base.id });
    }
    await refresh();
  });
  return (
    <section className={`${card} space-y-3 border-mint/40`}>
      <h3 className="font-semibold">Allow trading with your USDC</h3>
      <p className="text-sm text-dim">
        One-time approval{needed.length > 1 ? "s" : ""} to Veranta&apos;s trading contract
        {needed.length > 1 ? " and builder-fee registry" : ""}. Your wallet pays a little gas on Base. Choose a cap:
      </p>
      <div className="flex gap-2">
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal"
          className="w-28 rounded-lg border border-line bg-black px-3 text-base outline-none focus:border-mint" />
        <button className={btn} disabled={!!busy || !(Number(amount) > 0)} onClick={approve}>{busy || `Approve $${amount}`}</button>
      </div>
    </section>
  );
}

function Chat({ token, busy, run, refresh }: Props) {
  const [log, setLog] = useState<{ me: boolean; text: string; token?: string | null }[]>([]);
  const [text, setText] = useState("");
  const say = (entry: (typeof log)[number]) => setLog((l) => [...l.slice(-30), entry]);
  const send = () => text.trim() && run("Thinking…", async () => {
    say({ me: true, text });
    setText("");
    const r = await api("/api/chat", token, { text });
    say({ me: false, text: r.reply, token: r.token });
  });
  const confirm = (t: string) => run("Executing…", async () => {
    setLog((l) => l.map((m) => (m.token === t ? { ...m, token: null } : m)));
    say({ me: false, text: (await api("/api/confirm", token, { token: t })).reply });
    await refresh();
  });
  return (
    <section className={card}>
      <h3 className="mb-3 font-semibold">Trade</h3>
      <div className="max-h-80 space-y-2 overflow-y-auto">
        {!log.length && <p className="text-sm text-dim">Try “long $20 ETH 5x sl 5%”, “close my ETH” or “close everything”.</p>}
        {log.map((m, i) => (
          <div key={i} className={`whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-sm ${m.me ? "ml-8 bg-mint/10" : "mr-8 bg-black"}`}>
            {m.text}
            {m.token && (
              <div className="mt-2 flex gap-2">
                <button className={ghost} disabled={!!busy} onClick={() => confirm(m.token!)}>Execute</button>
                <button className={ghost} onClick={() => setLog((l) => l.map((x) => (x === m ? { ...x, token: null } : x)))}>Cancel</button>
              </div>
            )}
          </div>
        ))}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="long $20 ETH 5x"
          className="min-w-0 flex-1 rounded-lg border border-line bg-black px-3 py-2 text-base outline-none focus:border-mint" />
        <button className="rounded-lg bg-mint px-4 font-semibold text-black disabled:opacity-50" disabled={!!busy || !text.trim()}>Send</button>
      </form>
    </section>
  );
}
