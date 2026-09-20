"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import EthereumProvider from "@walletconnect/ethereum-provider";

// Set via NEXT_PUBLIC_* env vars at build time on Vercel.
const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "";
const BOT_API = process.env.NEXT_PUBLIC_BOT_API || "https://api.tradr.gg";

const CHAIN_ID = 8453; // Base
const CHAIN_HEX = "0x2105";

type Status =
  | "idle"
  | "pairing"
  | "connected"
  | "signing"
  | "submitted"
  | "error";

export default function ConnectPage() {
  return (
    <Suspense fallback={<p className="p-6">Loading…</p>}>
      <ConnectInner />
    </Suspense>
  );
}

function ConnectInner() {
  const params = useSearchParams();
  const sid = params.get("sid") || "";
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [typedData, setTypedData] = useState<Record<string, unknown> | null>(null);
  const [provider, setProvider] = useState<EthereumProvider | null>(null);

  useEffect(() => {
    if (!sid) {
      setError("Missing session id. Open this page from the Telegram bot.");
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
          methods: ["eth_sendTransaction", "eth_signTypedData_v4", "personal_sign"],
          events: ["accountsChanged", "chainChanged"],
          metadata: {
            name: "tradr",
            description: "Delegate signing for tradr bot",
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

        // Prepare: tell the bot our wallet; receive the typed data to sign.
        const rp = await fetch(`${BOT_API}/api/connect/${sid}/prepare`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: addr }),
        });
        if (!rp.ok) {
          const t = await rp.text();
          throw new Error(`prepare failed: ${rp.status} ${t}`);
        }
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
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setStatus("error");
    }
  }

  return (
    <main className="mx-auto max-w-md p-6 font-sans">
      <h1 className="text-2xl font-semibold">Connect your wallet to tradr</h1>
      <p className="mt-2 text-sm opacity-80">
        Signing this message authorizes our bot to trade on your behalf on Veranta.
        Your funds stay in your wallet. You can revoke anytime from delegate.veranta.xyz.
      </p>

      <div className="mt-6 rounded border p-4">
        <div className="text-sm">Session</div>
        <div className="break-all font-mono text-xs">{sid || "—"}</div>
        <div className="mt-3 text-sm">Wallet</div>
        <div className="break-all font-mono text-xs">{address || "Not connected"}</div>
        <div className="mt-3 text-sm">Chain</div>
        <div className="font-mono text-xs">{CHAIN_HEX} (Base)</div>
      </div>

      {status === "connected" && (
        <button
          onClick={signNow}
          className="mt-6 w-full rounded bg-black px-4 py-3 text-white"
        >
          Sign delegation
        </button>
      )}
      {status === "pairing" && <p className="mt-6">Pairing via WalletConnect…</p>}
      {status === "signing" && <p className="mt-6">Check your wallet to sign.</p>}
      {status === "submitted" && (
        <p className="mt-6">Submitted. Return to Telegram — the bot will confirm.</p>
      )}
      {status === "error" && (
        <p className="mt-6 text-red-600">Error: {error}</p>
      )}
    </main>
  );
}
