"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import EthereumProvider from "@walletconnect/ethereum-provider";

const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "";
const BOT_API = process.env.NEXT_PUBLIC_BOT_API || "https://api.tradr.gg";
const CHAIN_ID = 8453;
const CHAIN_HEX = "0x2105";

type Status =
  | "idle"
  | "pairing"
  | "connected"
  | "signing"
  | "submitted"
  | "error";

type Step = 1 | 2 | 3;

export default function ConnectInner() {
  const params = useSearchParams();
  const sid = params.get("sid") || "";
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [typedData, setTypedData] = useState<Record<string, unknown> | null>(null);
  const [provider, setProvider] = useState<EthereumProvider | null>(null);
  const [tx, setTx] = useState<string>("");

  useEffect(() => {
    if (!sid) {
      setError("Missing session. Open this page from the Telegram bot.");
      setStatus("error");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setStatus("pairing");
        const prov = await EthereumProvider.init({
          projectId: WC_PROJECT_ID,
          chains: [CHAIN_ID],
          showQrModal: true,
          methods: ["eth_signTypedData_v4", "personal_sign"],
          events: ["accountsChanged", "chainChanged"],
          metadata: {
            name: "AgentHub",
            description: "Delegate signing for AgentHub agents",
            url: typeof window !== "undefined" ? window.location.origin : "",
            icons: [],
          },
        });
        prov.on("accountsChanged", (accs: string[]) => {
          if (accs[0]) setAddress(accs[0]);
        });
        await prov.connect();
        if (cancelled) return;
        const addr = prov.accounts[0];
        if (!addr) throw new Error("WalletConnect returned no account");
        setAddress(addr);
        setProvider(prov);

        const rp = await fetch(`${BOT_API}/api/connect/${sid}/prepare`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: addr }),
        });
        if (!rp.ok) throw new Error(`prepare failed: ${rp.status}`);
        const p = await rp.json();
        setTypedData(p.typedData);
        setStatus("connected");
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
  }, [sid]);

  async function signNow() {
    if (!provider || !address || !typedData || !sid) return;
    try {
      setStatus("signing");
      const sig = (await provider.request({
        method: "eth_signTypedData_v4",
        params: [address, JSON.stringify(typedData)],
      })) as string;
      setStatus("submitted");
      const r = await fetch(`${BOT_API}/api/connect/${sid}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature: sig }),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(`submit failed: ${r.status} ${t}`);
      }
      const j = await r.json().catch(() => ({}));
      if (j?.tx) setTx(j.tx);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setStatus("error");
    }
  }

  const step: Step = status === "pairing" ? 1 : status === "connected" || status === "signing" ? 2 : 3;

  return (
    <main className="min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-text)]">
      <div className="mx-auto max-w-md px-5 pb-16 pt-10">
        {/* Wordmark */}
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
          You're signing a <em>delegate</em> permission. Agents may{" "}
          <span className="text-[color:var(--color-text)]">open and close positions</span>{" "}
          inside guarded limits you set. They can never withdraw funds — control stays with you.
        </p>

        {/* Step rail */}
        <ol className="mt-8 space-y-2">
          {[
            { n: 1, label: "Connect wallet", done: step > 1 },
            { n: 2, label: "Review & sign delegation", done: step > 2 },
            { n: 3, label: "Return to Telegram", done: status === "submitted" && step === 3 },
          ].map((s) => (
            <li key={s.n} className="flex items-center gap-3 text-sm">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold ${
                  s.done
                    ? "border-[color:var(--color-mint)] bg-[color:var(--color-mint)]/15 text-[color:var(--color-mint)]"
                    : step === s.n
                    ? "border-[color:var(--color-mint)] text-[color:var(--color-mint)]"
                    : "border-[color:var(--color-border-strong)] text-[color:var(--color-text-mute)]"
                }`}
              >
                {s.done ? "✓" : s.n}
              </span>
              <span className={s.done ? "text-[color:var(--color-text)]" : "text-[color:var(--color-text-dim)]"}>
                {s.label}
              </span>
            </li>
          ))}
        </ol>

        {/* Details card */}
        <div className="brand-card mt-8 p-5">
          <div className="brand-row">
            <span className="brand-label">Session</span>
            <span className="brand-value break-all text-right">{sid ? sid.slice(0, 10) + "…" : "—"}</span>
          </div>
          <div className="brand-row">
            <span className="brand-label">Wallet</span>
            <span className="brand-value break-all text-right">
              {address ? address.slice(0, 6) + "…" + address.slice(-4) : "Not connected"}
            </span>
          </div>
          <div className="brand-row">
            <span className="brand-label">Network</span>
            <span className="brand-value">Base (chain {CHAIN_HEX})</span>
          </div>
          <div className="brand-row">
            <span className="brand-label">Permissions</span>
            <span className="text-[color:var(--color-text)] text-[13px] font-medium">Trade only · No withdrawals</span>
          </div>
        </div>

        {/* Action block */}
        <div className="mt-8">
          {status === "pairing" && (
            <div className="flex items-center gap-2 text-sm text-[color:var(--color-text-dim)]">
              <span className="h-3 w-3 animate-pulse rounded-full bg-[color:var(--color-mint)]" />
              Pairing via WalletConnect…
            </div>
          )}
          {status === "connected" && (
            <button onClick={signNow} className="brand-button">
              Sign delegation
            </button>
          )}
          {status === "signing" && (
            <div className="text-sm text-[color:var(--color-text-dim)]">
              Confirm in your wallet…
            </div>
          )}
          {status === "submitted" && (
            <div className="rounded-lg border border-[color:var(--color-mint)] bg-[color:var(--color-mint)]/10 p-4">
              <p className="text-sm font-medium text-[color:var(--color-mint)]">
                Delegation submitted.
              </p>
              <p className="mt-1 text-xs text-[color:var(--color-text-dim)]">
                Return to Telegram. The bot will message you when it's on-chain.
              </p>
              {tx && (
                <p className="mt-2 break-all font-mono text-[11px] text-[color:var(--color-text-mute)]">
                  tx: {tx.slice(0, 10)}…{tx.slice(-6)}
                </p>
              )}
            </div>
          )}
          {status === "error" && (
            <div className="rounded-lg border border-[color:var(--color-danger)] bg-[color:var(--color-danger)]/10 p-4 text-sm text-[color:var(--color-danger)]">
              {error || "Something went wrong. Retry from the Telegram bot."}
            </div>
          )}
        </div>

        <p className="mt-10 text-center text-xs text-[color:var(--color-text-mute)]">
          Revocable anytime. Funds never leave your wallet.
        </p>

        <footer className="mt-16 border-t border-[color:var(--color-border)] pt-6 text-center">
          <p className="text-[11px] tracking-wide text-[color:var(--color-text-mute)]">
            Powered by <span className="text-[color:var(--color-text-dim)]">Veranta</span>
          </p>
        </footer>
      </div>
    </main>
  );
}
