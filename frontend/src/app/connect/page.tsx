"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAccount, useSignTypedData } from "wagmi";
import { useAppKit } from "@reown/appkit/react";

const BOT_API = process.env.NEXT_PUBLIC_BOT_API || "https://api.agenthub.gg";

type Status = "idle" | "readying" | "signing" | "submitting" | "done" | "error";

function ConnectInner() {
  const params = useSearchParams();
  const sid = params.get("sid") || "";
  const { address, isConnected } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const { open } = useAppKit();

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const [typedData, setTypedData] = useState<Record<string, unknown> | null>(null);
  const [tx, setTx] = useState<string>("");

  // Auto-open AppKit modal on mount if not connected
  useEffect(() => {
    if (!sid) return;
    if (!isConnected) {
      open();
    }
  }, [sid, isConnected, open]);

  // When wallet connects, fetch typed-data for this sid
  useEffect(() => {
    if (!sid || !address || typedData) return;
    let cancelled = false;
    (async () => {
      try {
        setStatus("readying");
        const rp = await fetch(`${BOT_API}/api/connect/${sid}/prepare`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address }),
        });
        if (!rp.ok) throw new Error(`prepare failed: ${rp.status}`);
        const p = await rp.json();
        if (!cancelled) {
          setTypedData(p.typedData);
          setStatus("idle");
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? String(e));
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sid, address, typedData]);

  async function signAndSubmit() {
    if (!address || !typedData || !sid) return;
    try {
      setStatus("signing");
      const signature = await signTypedDataAsync({
        domain: (typedData as any).domain,
        types: (typedData as any).types,
        primaryType: (typedData as any).primaryType,
        message: (typedData as any).message,
      });
      setStatus("submitting");
      const r = await fetch(`${BOT_API}/api/connect/${sid}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature }),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`submit failed: ${r.status} ${t}`);
      }
      const j = await r.json().catch(() => ({}));
      if (j?.tx) setTx(j.tx);
      setStatus("done");
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || String(e));
      setStatus("error");
    }
  }

  return (
    <main className="min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-text)]">
      <div className="mx-auto max-w-md px-5 pb-16 pt-10">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-gradient-to-br from-[color:var(--color-mint)] to-[color:var(--color-mint-dark)]" />
          <span className="text-sm font-semibold tracking-wide text-[color:var(--color-text-dim)]">
            AgentHub
          </span>
        </div>

        <h1 className="mt-10 text-3xl font-semibold leading-tight">
          Connect your wallet.
          <br />
          <span className="brand-mint-text">Let agents act for you.</span>
        </h1>

        <p className="mt-4 text-sm leading-relaxed text-[color:var(--color-text-dim)]">
          Sign a <em>delegate</em> intent so our platform can place trades on your behalf
          for 30 days, capped to your limits. One signature. No gas on your side.
        </p>

        <div className="brand-card mt-8 p-5">
          <div className="brand-row">
            <span className="brand-label">Session</span>
            <span className="brand-value break-all text-right">
              {sid ? sid.slice(0, 10) + "…" : "—"}
            </span>
          </div>
          <div className="brand-row">
            <span className="brand-label">Wallet</span>
            <span className="brand-value break-all text-right">
              {address || "not connected"}
            </span>
          </div>

          <div className="mt-5">
            {!isConnected && (
              <appkit-button />
            )}
            {isConnected && typedData && status !== "done" && status !== "submitting" && (
              <button
                onClick={signAndSubmit}
                disabled={status === "signing"}
                className="brand-button w-full"
              >
                {status === "signing" ? "Sign in wallet…" : "Sign delegation"}
              </button>
            )}
            {isConnected && !typedData && status !== "error" && (
              <p className="text-xs text-[color:var(--color-text-mute)]">
                {status === "readying" ? "Preparing intent…" : "Loading…"}
              </p>
            )}
            {(status === "submitting") && (
              <p className="text-xs text-[color:var(--color-text-mute)]">Submitting on-chain…</p>
            )}
          </div>

          {status === "done" && (
            <div className="mt-4">
              <p className="text-sm text-[color:var(--color-mint)]">Wallet connected + delegate registered.</p>
              {tx && (
                <a
                  href={`https://basescan.org/tx/${tx}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block text-xs text-[color:var(--color-mint)] underline"
                >
                  View registration tx
                </a>
              )}
              <p className="mt-2 text-xs text-[color:var(--color-text-mute)]">
                Return to Telegram — the bot now trades for you within your caps.
              </p>
            </div>
          )}

          {error && (
            <p className="mt-4 text-xs text-red-400">{error}</p>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ConnectPage() {
  return (
    <Suspense>
      <ConnectInner />
    </Suspense>
  );
}
