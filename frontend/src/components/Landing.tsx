"use client";

import { useAppKit } from "@reown/appkit/react";
import { BOT } from "@/lib/agenthub";
import { Button, Pill } from "./ui";

const FEATURES = [
  ["Talk, don't click", "“Long $20 ETH 5x with a 5% stop.” Market and limit orders, partial closes, stops, margin, all in plain English."],
  ["Hard limits, every order", "Leverage, size per trade, daily volume, open positions and a daily loss stop are checked before anything executes."],
  ["Self-custody", "A 30-day trading key that can open and close positions but can never withdraw or move your USDC. Revoke anytime."],
  ["Any agent, one account", "Trade from this site, Telegram, Claude or Cursor via MCP, or a Bankr agent. Same limits everywhere."],
] as const;

const STEPS = [
  ["Connect", "Any Base wallet. Sign in with one free signature."],
  ["Set limits & enable", "Pick your caps and sign one gasless delegation."],
  ["Trade by chatting", "Get a quote, say yes, it fills on Veranta."],
] as const;

const CHANNELS = [
  ["Web console", "This site"], ["Telegram", "@tradr_aibot"], ["MCP", "Claude, Cursor, any client"],
  ["Bankr skill", "agenthub"], ["x402 API", "$0.01 per executed trade"],
] as const;

function Demo() {
  return (
    <div className="relative animate-rise rounded-2xl border border-line bg-panel/90 p-4 shadow-2xl shadow-mint/5 backdrop-blur">
      <div className="mb-3 flex items-center justify-between text-xs text-mute">
        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-gain" /> AgentHub agent</span>
        <span>Base · Veranta</span>
      </div>
      <div className="space-y-3 text-sm">
        <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-mint/15 px-3.5 py-2">long $20 ETH 5x with a 5% stop</p>
        <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-line bg-card p-3.5">
          <div className="flex items-center justify-between"><b>LONG ETH/USD · 5x</b><Pill tone="gain">passes your limits</Pill></div>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs text-dim">
            <dt>Size</dt><dd className="text-right text-white">$100.00</dd>
            <dt>Entry</dt><dd className="text-right text-white">~2,678.40</dd>
            <dt>Stop</dt><dd className="text-right text-white">2,544.48</dd>
            <dt>Liquidation</dt><dd className="text-right text-white">~2,223.07</dd>
          </dl>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <span className="rounded-lg bg-mint py-1.5 text-center text-xs font-semibold text-black">Execute</span>
            <span className="rounded-lg border border-line py-1.5 text-center text-xs text-dim">Cancel</span>
          </div>
        </div>
        <p className="max-w-[85%] rounded-2xl rounded-bl-md border border-line bg-card px-3.5 py-2 text-dim">
          Filled: long ETH/USD $20 @ 5x ✓
        </p>
      </div>
    </div>
  );
}

export default function Landing() {
  const { open } = useAppKit();
  const connect = <Button onClick={() => open()} className="px-6 py-3 text-base">Connect wallet</Button>;
  return (
    <div className="bg-grid">
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pb-24 lg:pt-20">
        <div className="animate-rise">
          <Pill tone="mint">AI trading agent · perps on Base</Pill>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Your trading agent,<br /><span className="bg-gradient-to-r from-mint to-gain bg-clip-text text-transparent">inside your limits.</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg text-dim">
            Tell it what to trade in plain English. It quotes, checks your caps, and executes on Veranta after you say yes.
            Your USDC never leaves your wallet.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {connect}
            <a href={BOT} className="rounded-xl border border-line px-6 py-3 text-base font-semibold text-dim transition hover:border-mint/40 hover:text-white">
              Open in Telegram
            </a>
          </div>
          <p className="mt-4 text-xs text-mute">Gasless setup · 30-day revocable key · works with MetaMask, Rabby, Coinbase Wallet</p>
        </div>
        <Demo />
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(([t, d]) => (
            <div key={t} className="rounded-2xl border border-line bg-card/60 p-5">
              <h3 className="font-semibold">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-dim">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-panel/60">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold sm:text-3xl">Live in three steps</h2>
            <ol className="mt-6 space-y-5">
              {STEPS.map(([t, d], i) => (
                <li key={t} className="flex gap-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-mint/40 font-mono text-sm text-mint">{i + 1}</span>
                  <div><b>{t}</b><p className="text-sm text-dim">{d}</p></div>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h2 className="text-2xl font-semibold sm:text-3xl">One account, every agent</h2>
            <ul className="mt-6 divide-y divide-line rounded-2xl border border-line bg-card/60">
              {CHANNELS.map(([t, d]) => (
                <li key={t} className="flex items-center justify-between px-4 py-3 text-sm"><b>{t}</b><span className="text-dim">{d}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h2 className="text-3xl font-semibold sm:text-4xl">Hand the busywork to an agent.<br />Keep the keys.</h2>
        <div className="mt-8 flex justify-center">{connect}</div>
      </section>
    </div>
  );
}
