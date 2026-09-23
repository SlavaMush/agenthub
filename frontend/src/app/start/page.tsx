"use client";

import { Suspense, useEffect, useState } from "react";
import { useAccount, useSignTypedData } from "wagmi";
import { base } from "wagmi/chains";

const BOT_API = process.env.NEXT_PUBLIC_BOT_API || "https://api.agenthub.gg";

type Status = "idle" | "readying" | "signing" | "submitting" | "done" | "error";

const DEFAULTS = {
  maxLeverage: 3,
  maxSizeUsd: 100,
  maxDailyUsd: 500,
  maxPositions: 3,
  maxDailyLossUsd: 50,
};

const DOMAIN = {
  name: "AgentHub",
  version: "1",
  chainId: base.id,
} as const;

const TYPES = {
  Policy: [
    { name: "trader", type: "address" },
    { name: "maxLeverage", type: "uint256" },
    { name: "maxSizeUsd", type: "uint256" },
    { name: "maxDailyUsd", type: "uint256" },
    { name: "maxPositions", type: "uint256" },
    { name: "maxDailyLossUsd", type: "uint256" },
  ],
} as const;

function StartInner() {
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const [status, setStatus] = useState<Status>("idle");
  const [note, setNote] = useState<string>("");
  const [policy, setPolicy] = useState<typeof DEFAULTS>(DEFAULTS);

  useEffect(() => {
    if (!address) return;
    setStatus("idle");
    setNote("");
  }, [address]);

  async function start() {
    if (!address) return;
    try {
      setStatus("signing");
      setNote("Sign the delegation with your wallet.");
      const msg = {
        trader: address as `0x${string}`,
        maxLeverage: BigInt(policy.maxLeverage),
        maxSizeUsd: BigInt(policy.maxSizeUsd),
        maxDailyUsd: BigInt(policy.maxDailyUsd),
        maxPositions: BigInt(policy.maxPositions),
        maxDailyLossUsd: BigInt(policy.maxDailyLossUsd),
      };
      const signature = await signTypedDataAsync({
        domain: DOMAIN,
        types: TYPES,
        primaryType: "Policy",
        message: msg,
      });
      setStatus("submitting");
      setNote("Submitting to agent…");
      const r = await fetch(`${BOT_API}/api/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trader: address,
          policy: {
            max_leverage: policy.maxLeverage,
            max_size_usd: policy.maxSizeUsd,
            max_daily_usd: policy.maxDailyUsd,
            max_positions: policy.maxPositions,
            max_daily_loss_usd: policy.maxDailyLossUsd,
          },
          signature,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setStatus("done");
      setNote(`Policy locked in. Talk to the agent below — you're live.`);
    } catch (e: any) {
      setStatus("error");
      setNote(e?.message || String(e));
    }
  }

  return (
    <main className="min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-text)]">
      <section className="mx-auto max-w-2xl px-6 py-16">
        <a href="/" className="text-xs text-[color:var(--color-text-mute)] hover:text-[color:var(--color-mint)]">
          ← back to home
        </a>
        <h1 className="mt-6 text-3xl font-semibold">Enable the Agent</h1>
        <p className="mt-3 text-sm text-[color:var(--color-text-dim)]">
          One signature sets hard caps for the agent on your wallet. Your funds never leave your
          wallet — you only delegate trades, within these limits.
        </p>

        <div className="brand-card mt-8 p-5">
          <p className="text-xs uppercase tracking-wider text-[color:var(--color-text-mute)]">
            Wallet
          </p>
          <p className="mt-1 font-mono text-sm text-[color:var(--color-mint)]">
            {address ?? "not connected"}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {(
              [
                ["Max leverage", "maxLeverage"],
                ["$ per trade", "maxSizeUsd"],
                ["$ per day", "maxDailyUsd"],
                ["Max positions", "maxPositions"],
                ["Max daily loss ($)", "maxDailyLossUsd"],
              ] as const
            ).map(([label, key]) => (
              <label key={key} className="block">
                <span className="text-[11px] text-[color:var(--color-text-mute)]">{label}</span>
                <input
                  type="number"
                  min={1}
                  value={policy[key] as number}
                  onChange={(e) =>
                    setPolicy((p) => ({ ...p, [key]: parseInt(e.target.value || "1", 10) }))
                  }
                  className="mt-1 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-bg-elevated)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-mint)]"
                />
              </label>
            ))}
          </div>

          <button
            onClick={start}
            disabled={!address || status === "signing" || status === "submitting"}
            className="brand-button mt-5 disabled:opacity-50"
          >
            {status === "signing"
              ? "Sign in wallet…"
              : status === "submitting"
              ? "Saving…"
              : "Enable agent"}
          </button>

          {note && (
            <p className="mt-4 text-xs text-[color:var(--color-text-mute)] whitespace-pre-line">
              {note}
            </p>
          )}
          {status === "done" && (
            <p className="mt-3 text-sm text-[color:var(--color-mint)]">
              Done. <a href="/" className="underline">Back to chat</a>
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

export default function StartPage() {
  return (
    <Suspense>
      <StartInner />
    </Suspense>
  );
}
