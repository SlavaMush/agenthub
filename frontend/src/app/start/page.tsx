"use client";

import { Suspense, useEffect, useState } from "react";
import { useAccount, useSignTypedData } from "wagmi";
import Link from "next/link";

const BOT_API = process.env.NEXT_PUBLIC_BOT_API || "https://api.agenthub.gg";

type Status =
  | "idle"
  | "preparing"
  | "signing"
  | "submitting"
  | "done"
  | "error";

const DEFAULTS = {
  maxLeverage: 3,
  maxSizeUsd: 100,
  maxDailyUsd: 500,
  maxPositions: 3,
  maxDailyLossUsd: 50,
};

export function StartInner({ inCard = true, onDone }: { inCard?: boolean; onDone?: () => void }) {
  const { address, isConnected } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const [status, setStatus] = useState<Status>("idle");
  const [note, setNote] = useState<string>("");
  const [tx, setTx] = useState<string | null>(null);
  const [policy, setPolicy] = useState<typeof DEFAULTS>(DEFAULTS);

  useEffect(() => {
    setStatus("idle");
    setNote("");
    setTx(null);
  }, [address]);

  async function run() {
    if (!address) return;
    try {
      setStatus("preparing");
      setNote("Preparing delegation intent…");
      // 1) Get the typed-data we need to sign.
      const prepR = await fetch(`${BOT_API}/api/onboard/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trader: address }),
      });
      const prep = await prepR.json();
      if (!prepR.ok) throw new Error(prep.error || "prepare failed");

      // 2) Sign in browser.
      setStatus("signing");
      setNote("Sign the delegation in your wallet. One signature. No gas.");
      const signature = await signTypedDataAsync({
        domain: prep.typedData.domain,
        types: prep.typedData.types,
        primaryType: prep.typedData.primaryType,
        message: prep.typedData.message,
      });

      // 3) Submit; the platform relayer pays gas on-chain.
      setStatus("submitting");
      setNote("Registering delegate on-chain…");
      const subR = await fetch(`${BOT_API}/api/onboard/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trader: address,
          signature,
          encodedIntent: prep.encodedIntent,
          policy: {
            max_leverage: policy.maxLeverage,
            max_size_usd: policy.maxSizeUsd,
            max_daily_usd: policy.maxDailyUsd,
            max_positions: policy.maxPositions,
            max_daily_loss_usd: policy.maxDailyLossUsd,
          },
        }),
      });
      const sub = await subR.json().catch(() => ({}));
      if (!subR.ok) throw new Error(sub.error || `HTTP ${subR.status}`);
      setTx(sub.tx || null);
      setStatus("done");
      setNote("Delegate registered on-chain. Policy saved.");
      // Tell the parent (home) so it flips to chat view
      if (onDone) setTimeout(onDone, 800);
    } catch (e: any) {
      setStatus("error");
      setNote(e?.shortMessage || e?.message || String(e));
    }
  }

  const inner = (
    <>
      <div className="brand-card p-5">
        {!isConnected ? (
          <div>
            <p className="text-xs uppercase tracking-wider text-[color:var(--color-text-mute)]">
              Step 0 — connect wallet
            </p>
            <div className="mt-3 flex items-center gap-3">
              <appkit-button />
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs uppercase tracking-wider text-[color:var(--color-text-mute)]">
              Wallet
            </p>
            <p className="mt-1 font-mono text-sm text-[color:var(--color-mint)]">{address}</p>

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
              onClick={run}
              disabled={
                status === "preparing" || status === "signing" || status === "submitting"
              }
              className="brand-button mt-5 disabled:opacity-50"
            >
              {status === "preparing" && "Preparing…"}
              {status === "signing" && "Sign in wallet…"}
              {status === "submitting" && "Submitting on-chain…"}
              {(status === "idle" || status === "error") && "Sign + register delegate"}
              {status === "done" && "Registered"}
            </button>

            {note && (
              <p
                className={`mt-4 whitespace-pre-line text-xs ${
                  status === "error" ? "text-red-400" : "text-[color:var(--color-text-mute)]"
                }`}
              >
                {note}
              </p>
            )}
            {status === "done" && (
              <div className="mt-3">
                {tx && (
                  <a
                    href={`https://basescan.org/tx/${tx}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[color:var(--color-mint)] underline"
                  >
                    View registration tx
                  </a>
                )}
                <p className="mt-2 text-sm text-[color:var(--color-mint)]">
                  You're live. Start trading.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );

  if (!inCard) return inner;

  return (
    <main className="min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-text)]">
      <section className="mx-auto max-w-2xl px-6 py-16">
        <Link
          href="/"
          className="text-xs text-[color:var(--color-text-mute)] hover:text-[color:var(--color-mint)]"
        >
          ← back to home
        </Link>
        <h1 className="mt-6 text-3xl font-semibold">Enable the Agent</h1>
        <p className="mt-3 text-sm text-[color:var(--color-text-dim)]">
          Two things happen here:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[color:var(--color-text-dim)]">
          <li>
            You sign an on-chain <strong>delegate</strong> registration that lets the
            AgentHub platform place trades on your behalf for 30 days. No gas — we relay it.
          </li>
          <li>
            You pick hard caps (leverage, size, daily spend, daily loss). The agent
            never exceeds them.
          </li>
        </ul>
        <div className="mt-8">{inner}</div>
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
