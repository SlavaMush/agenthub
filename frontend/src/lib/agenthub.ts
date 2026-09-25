"use client";

import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useConfig, useSendTransaction, useSignMessage, useSignTypedData, useSwitchChain, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { erc20Abi, parseUnits } from "viem";
import { base } from "@reown/appkit/networks";

export const API = process.env.NEXT_PUBLIC_BOT_API || "https://api.agenthub.gg";
export const BOT = "https://t.me/tradr_aibot";
export const LIMITS = [
  ["max_leverage", "Max leverage", "x"],
  ["max_collateral", "Per trade", "$"],
  ["max_daily_notional", "Size / day", "$"],
  ["max_positions", "Open positions", "#"],
  ["max_daily_loss", "Daily loss stop", "$"],
] as const;

export type Hex = `0x${string}`;
export type Policy = Record<(typeof LIMITS)[number][0], number>;
export type Position = { pair: string; side: string; collateral: number; leverage: number; entry: number; liq: number; pnl: number };
export type Order = { pair: string; side: string; collateral: number; leverage: number; price: number };
export type Me = {
  wallet: string; active: boolean; expires: number; paused: boolean; telegram: boolean; referred: boolean; referralCode: string;
  policy: Policy; usdc?: Hex; balance?: number; approvals?: { spender: Hex; allowance: number }[]; positions?: Position[]; orders?: Order[];
};
export type Step = (label: string) => void;
export type Run = (label: string, fn: (step: Step) => Promise<void>) => Promise<void>;
export type Session = { me: Me; token: string; run: Run; busy: string; refresh: () => Promise<void> };

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string | null) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch {} },
};

export class ApiError extends Error { constructor(msg: string, public status: number) { super(msg); } }

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON responses are shaped per call site
export async function api<T = any>(path: string, token: string | null, body?: object): Promise<T> {
  const r = await fetch(API + path, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body && JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(j.error || `Request failed (${r.status})`, r.status);
  return j;
}

const errText = (e: unknown) => { const x = e as { shortMessage?: string; message?: string }; return x?.shortMessage || x?.message || String(e); };
export const usd = (n?: number) => (n === undefined ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD" }));
export const daysLeft = (me: Me) => Math.max(0, Math.floor((me.expires - Date.now() / 1000) / 86400));

/** Wallet sign-in, the account snapshot (polled with React Query), and a busy/error runner shared by every panel. */
export function useSession() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const key = `agenthub:${address?.toLowerCase()}`;
  const [tokens, setTokens] = useState<Record<string, string | null>>({});  // per wallet, falls back to localStorage
  const token = address ? (key in tokens ? tokens[key] : store.get(key)) : null;
  const setToken = useCallback((t: string | null) => { store.set(key, t); setTokens((x) => ({ ...x, [key]: t })); }, [key]);
  const signOut = useCallback(() => setToken(null), [setToken]);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const delegate = useDelegate();
  const status = useQuery({  // no session yet: returning wallets sign in, new ones set up (one signature either way)
    queryKey: ["status", address], enabled: !!address && !token,
    queryFn: () => api<{ active: boolean }>(`/api/status?wallet=${address}`, null),
  });

  const q = useQuery({
    queryKey: ["me", token], enabled: !!token, refetchInterval: 30_000, retry: false,
    queryFn: async () => {
      try { return await api<Me>("/api/me", token); }
      catch (e) { if (e instanceof ApiError && e.status === 401) signOut(); throw e; }
    },
  });
  const me = q.data && q.data.wallet === address?.toLowerCase() ? q.data : null;
  const refresh = useCallback(async () => { await q.refetch(); }, [q]);

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
    setToken(r.token);
  });
  const onboard = (policy: Policy) => run("Preparing…", async (step) => setToken((await delegate(null, step, policy)).token));
  return { token, me, busy, returning: status.data?.active, onboard, err: err || (q.error && !(q.error instanceof ApiError && q.error.status === 401) ? errText(q.error) : ""), setErr, run, refresh, signIn, signOut };
}

/** Make sure the wallet is on Base: typed data pins chainId 8453 and wallets refuse other chains. */
function useOnBase() {
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  return async (step: Step) => { if (chainId !== base.id) { step("Switch your wallet to Base…"); await switchChainAsync({ chainId: base.id }); } };
}

/** Sign the gasless delegation. Without a session this is onboarding: the same signature also signs you in. */
function useDelegate() {
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const onBase = useOnBase();
  return async (token: string | null, step: Step, policy?: Policy) => {
    await onBase(step);
    step("Preparing…");
    const path = token ? "/api/delegate" : "/api/onboard";
    const { ref, typedData } = await api(`${path}/prepare`, token, { wallet: address });
    step("Sign the trading delegation in your wallet…");
    const signature = await signTypedDataAsync(typedData);
    step("Enabling on-chain (gasless)…");
    return api(`${path}/submit`, token, { ref, signature, policy });
  };
}

/** Renew or re-enable trading while signed in (optional new limits first). */
export function useEnable({ token, run, refresh }: Session) {
  const delegate = useDelegate();
  return (policy?: Policy) => run("Preparing…", async (step) => {
    if (policy) await api("/api/policy", token, policy);
    await delegate(token, step);
    await refresh();
  });
}

/** Optional referral link: a plain tx from the wallet (Veranta's relayer won't carry it gaslessly for us). */
export function useReferral({ token, run, refresh }: Session) {
  const config = useConfig();
  const onBase = useOnBase();
  const { sendTransactionAsync } = useSendTransaction();
  return () => run("Preparing…", async (step) => {
    await onBase(step);
    const { transactions } = await api<{ transactions: { purpose: string; to: Hex; data: Hex; value: string }[] }>("/api/approvals?amount=0", token);
    const tx = transactions.find((t) => t.purpose === "referral");
    if (tx) {
      step("Confirm the referral link in your wallet…");
      const hash = await sendTransactionAsync({ to: tx.to, data: tx.data, value: BigInt(tx.value || 0), chainId: base.id });
      await waitForTransactionReceipt(config, { hash, chainId: base.id });
    }
    await api("/api/referral/linked", token, {});
    await refresh();
  });
}

/** USDC approvals the wallet sends itself: Veranta's trading contract and the builder-fee registry. */
export function useApprove({ me, run, refresh }: Session) {
  const config = useConfig();
  const onBase = useOnBase();
  const { writeContractAsync } = useWriteContract();
  const needed = (amount: number) => (me.approvals || []).filter((a) => a.allowance < Math.min(amount, me.balance || amount));
  const approve = (amount: number) => run("Preparing…", async (step) => {
    await onBase(step);
    const list = needed(amount);
    for (const [i, a] of list.entries()) {
      step(`Approve ${i + 1} of ${list.length} in your wallet…`);
      const hash = await writeContractAsync({ address: me.usdc!, abi: erc20Abi, functionName: "approve",
        args: [a.spender, parseUnits(String(amount), 6)], chainId: base.id });
      await waitForTransactionReceipt(config, { hash, chainId: base.id });
    }
    await refresh();
  });
  return { needed, approve };
}
