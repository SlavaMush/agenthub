"use client";

import { useState, useSyncExternalStore } from "react";
import { useAppKit } from "@reown/appkit/react";
import { useAccount } from "wagmi";
import Console from "@/components/Console";
import Landing from "@/components/Landing";
import { Account, Agents, LimitFields, Limits, Portfolio, Setup } from "@/components/Panels";
import { Button, Logo, Pill } from "@/components/ui";
import { BOT, useSession, type Policy, type Session } from "@/lib/agenthub";

const DEFAULT_POLICY: Policy = { max_leverage: 5, max_collateral: 100, max_daily_notional: 500, max_positions: 3, max_daily_loss: 50 };
const EOA_NOTE = "Needs a regular wallet (MetaMask, Rabby, Coinbase Wallet EOA). Smart wallets can't sign Veranta delegations.";

function SignIn({ busy, onSign }: { busy: string; onSign: () => void }) {
  return (
    <div className="w-full max-w-sm animate-rise rounded-2xl border border-line bg-card p-6 text-center">
      <p className="text-2xl font-semibold">Welcome back</p>
      <p className="mt-2 text-sm text-dim">Your agent is enabled. One free signature signs you in. No transaction, no gas.</p>
      <Button className="mt-6 w-full" disabled={!!busy} onClick={onSign}>{busy || "Sign in"}</Button>
    </div>
  );
}

function Onboard({ busy, onEnable }: { busy: string; onEnable: (p: Policy) => void }) {
  const [policy, setPolicy] = useState(DEFAULT_POLICY);
  return (
    <div className="w-full max-w-md animate-rise rounded-2xl border border-line bg-card p-6">
      <p className="text-2xl font-semibold">Set your limits</p>
      <p className="mt-2 text-sm text-dim">
        Then sign <b className="text-white">once</b>: a gasless delegation that lets your agent trade for 30 days inside these caps.
        It can never withdraw or move your USDC, and it signs you in.
      </p>
      <div className="mt-5"><LimitFields value={policy} onChange={setPolicy} /></div>
      <p className="mt-3 text-xs text-mute">Veranta&apos;s minimum position is $100 of size (collateral × leverage), e.g. $20 at 5x.</p>
      <Button className="mt-5 w-full" disabled={!!busy} onClick={() => onEnable(policy)}>{busy || "Sign & enable agent"}</Button>
      <p className="mt-4 text-center text-xs text-mute">{EOA_NOTE}</p>
    </div>
  );
}

type Tab = "trade" | "account" | "settings";
const TABS: [Tab, string][] = [["trade", "Trade"], ["account", "Account"], ["settings", "Settings"]];

export default function Home() {
  const { isConnected } = useAccount();
  const { open } = useAppKit();
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);  // wallet UI only after hydration
  const s = useSession();
  const [picked, setTab] = useState<Tab | null>(null);
  const session: Session | null = s.me && s.token ? { me: s.me, token: s.token, run: s.run, busy: s.busy, refresh: s.refresh } : null;
  const inApp = mounted && isConnected;
  const tab: Tab = picked ?? (s.me && !s.me.active ? "account" : "trade");  // mobile: land on setup first

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-xl">
        <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Logo />
            <div className="hidden items-center gap-5 text-sm text-dim md:flex">
              <a href={BOT} className="hover:text-white">Telegram</a>
              <a href="https://github.com/BankrBot/skills/pull/742" className="hover:text-white">Bankr skill</a>
              <a href="https://www.veranta.xyz" className="hover:text-white">Veranta</a>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex"><Pill tone="mint">Base</Pill></span>
            {!mounted ? <span className="h-9 w-24 rounded-xl bg-card" /> : isConnected ? <appkit-button balance="hide" size="sm" />
              : <Button onClick={() => open()} className="py-2">Connect</Button>}
          </div>
        </nav>
      </header>

      {s.err && (
        <div className="mx-auto mt-3 w-full max-w-7xl px-4 sm:px-6">
          <div className="flex items-start justify-between gap-3 rounded-xl border border-loss/30 bg-loss/10 px-4 py-3 text-sm text-loss">
            <p className="whitespace-pre-line wrap-break-word">{s.err}</p>
            <button onClick={() => s.setErr("")} className="shrink-0 text-loss/70 hover:text-loss">✕</button>
          </div>
        </div>
      )}

      {!inApp ? <Landing /> : !s.token ? (
        <main className="bg-grid grid flex-1 place-items-center px-4 py-12">
          {s.returning === undefined ? <p className="animate-pulse text-sm text-mute">Checking your wallet…</p>
            : s.returning ? <SignIn busy={s.busy} onSign={s.signIn} /> : <Onboard busy={s.busy} onEnable={s.onboard} />}
        </main>
      ) : !session ? (
        <main className="grid flex-1 place-items-center text-sm text-mute"><p className="animate-pulse">Loading your account…</p></main>
      ) : (
        <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-4 px-3 pb-24 pt-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:pb-6">
          <div className={`${tab === "trade" ? "block" : "hidden"} h-[calc(100dvh-10.5rem)] lg:block lg:h-[calc(100dvh-5.5rem)]`}>
            <Console {...session} />
          </div>
          <aside className={`${tab === "trade" ? "hidden lg:block" : ""} scrollbar-thin space-y-4 lg:h-[calc(100dvh-5.5rem)] lg:overflow-y-auto lg:pr-1`}>
            <div className={`${tab === "account" ? "" : "hidden lg:block"} space-y-4`}>
              <Setup {...session} /><Account {...session} /><Portfolio {...session} />
            </div>
            <div className={`${tab === "settings" ? "" : "hidden lg:block"} space-y-4`}>
              <Limits {...session} /><Agents {...session} signOut={s.signOut} />
            </div>
          </aside>
        </main>
      )}

      {session && (
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
          {TABS.map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} className={`py-3 text-sm font-medium ${tab === t ? "text-mint" : "text-mute"}`}>{label}</button>
          ))}
        </nav>
      )}

      {!session && (
        <footer className="border-t border-line py-8 text-center text-xs text-mute">
          Self-custody on Base · executes on <a className="underline hover:text-white" href="https://www.veranta.xyz">Veranta</a> ·{" "}
          <a className="underline hover:text-white" href={BOT}>Telegram</a>
        </footer>
      )}
    </div>
  );
}
