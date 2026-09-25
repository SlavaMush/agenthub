"use client";

import { useState } from "react";
import { API, BOT, LIMITS, api, daysLeft, usd, useApprove, useEnable, useReferral, type Policy, type Session } from "@/lib/agenthub";
import { Button, Card, Dot, Pill, input } from "./ui";

export function Account(s: Session) {
  const { me, token, run, busy, refresh } = s;
  const enable = useEnable(s);
  const days = daysLeft(me);
  const pnl = (me.positions || []).reduce((a, p) => a + p.pnl, 0);
  return (
    <Card title="Account" action={<Pill tone={me.paused ? "warn" : me.active ? "gain" : "neutral"}><Dot on={me.active && !me.paused} />{me.paused ? "Paused" : me.active ? "Live" : "Not enabled"}</Pill>}>
      <p className="text-xs text-mute">Wallet USDC on Base</p>
      <p className="font-mono text-3xl font-semibold tracking-tight">{usd(me.balance)}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-line bg-bg/60 p-2.5"><p className="text-mute">Open PnL</p>
          <p className={`font-mono text-sm ${pnl < 0 ? "text-loss" : "text-gain"}`}>{pnl >= 0 ? "+" : ""}{usd(pnl)}</p></div>
        <div className="rounded-xl border border-line bg-bg/60 p-2.5"><p className="text-mute">Trading key</p>
          <p className={`font-mono text-sm ${days < 7 ? "text-warn" : ""}`}>{me.active ? `${days}d left` : "—"}</p></div>
      </div>
      {me.active && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="ghost" disabled={!!busy} onClick={() => run("Saving…", async () => { await api("/api/policy", token, { paused: !me.paused }); await refresh(); })}>
            {me.paused ? "Resume trading" : "Pause trading"}
          </Button>
          {days < 7 && <Button variant="ghost" disabled={!!busy} onClick={() => enable()}>Renew key</Button>}
        </div>
      )}
    </Card>
  );
}

function LimitFields({ value, onChange }: { value: Policy; onChange: (p: Policy) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {LIMITS.map(([k, label, unit]) => (
        <label key={k} className="text-xs text-mute">
          {label} <span className="text-mute/70">({unit})</span>
          <input type="number" inputMode="decimal" min={1} value={value[k] ?? ""} onChange={(e) => onChange({ ...value, [k]: Number(e.target.value) })}
            className={`${input} mt-1 font-mono`} />
        </label>
      ))}
    </div>
  );
}

/** Onboarding as a checklist: enable (limits + delegation), approvals, optional referral. */
export function Setup(s: Session) {
  const { me, busy } = s;
  const [policy, setPolicy] = useState(me.policy);
  const [amount, setAmount] = useState(Math.max(100, Math.ceil(me.balance || 0)));
  const enable = useEnable(s);
  const { needed, approve } = useApprove(s);
  const linkReferral = useReferral(s);
  const toApprove = me.usdc ? needed(amount) : [];
  const steps = [
    { done: me.active, title: "Enable the agent", body: "Set your hard limits, then sign one gasless delegation (30 days). The key can trade but never move funds." },
    { done: me.active && !toApprove.length, title: "Allow USDC", body: `Approve Veranta's trading contract${(me.approvals?.length || 0) > 1 ? " and the fee registry" : ""} to use up to your cap. Small Base gas fee.` },
  ];
  if (steps.every((x) => x.done) && (me.referred || !me.referralCode)) return null;
  return (
    <Card title="Get started" className="border-mint/30">
      <ol className="space-y-4">
        {steps.map((st, i) => (
          <li key={st.title} className="flex gap-3">
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border font-mono text-xs ${st.done ? "border-gain bg-gain/15 text-gain" : "border-line text-dim"}`}>{st.done ? "✓" : i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{st.title}</p>
              {!st.done && <p className="mt-0.5 text-sm text-dim">{st.body}</p>}
              {!st.done && i === 0 && (
                <div className="mt-3 space-y-3">
                  <LimitFields value={policy} onChange={setPolicy} />
                  <p className="text-xs text-mute">Veranta&apos;s minimum position is $100 of size (collateral × leverage).</p>
                  <Button className="w-full" disabled={!!busy} onClick={() => enable(policy)}>{busy || "Sign & enable"}</Button>
                </div>
              )}
              {!st.done && i === 1 && me.active && (
                <div className="mt-3 flex gap-2">
                  <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className={`${input} w-24 font-mono`} />
                  <Button className="flex-1 whitespace-nowrap" disabled={!!busy || !(amount > 0)} onClick={() => approve(amount)}>{busy || `Approve ${usd(amount)}`}</Button>
                </div>
              )}
            </div>
          </li>
        ))}
        {me.active && !me.referred && me.referralCode && (
          <li className="flex items-center justify-between gap-3 rounded-xl border border-line bg-bg/50 p-3 text-sm">
            <span className="text-dim">Optional: link the <b className="text-white">{me.referralCode}</b> code for a Veranta fee discount (one small Base tx).</span>
            <Button variant="ghost" disabled={!!busy} onClick={linkReferral}>Link</Button>
          </li>
        )}
      </ol>
    </Card>
  );
}

export function Portfolio({ me }: Session) {
  const rows = [...(me.positions || []).map((p) => ({ ...p, kind: "pos" as const })), ...(me.orders || []).map((o) => ({ ...o, kind: "ord" as const }))];
  return (
    <Card title={`Positions${rows.length ? ` · ${rows.length}` : ""}`}>
      {!rows.length ? <p className="py-4 text-center text-sm text-mute">No open positions or orders.</p> : (
        <ul className="divide-y divide-line">
          {rows.map((r, i) => (
            <li key={i} className="py-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-semibold">
                  <Pill tone={r.side === "long" ? "gain" : "loss"}>{r.side}</Pill>{r.pair}<span className="font-mono text-xs text-mute">{r.leverage}x</span>
                </span>
                {r.kind === "pos"
                  ? <span className={`font-mono ${r.pnl < 0 ? "text-loss" : "text-gain"}`}>{r.pnl >= 0 ? "+" : ""}{usd(r.pnl)}</span>
                  : <Pill>limit {r.price.toLocaleString()}</Pill>}
              </div>
              {r.kind === "pos" && (
                <p className="mt-1 font-mono text-xs text-mute">{usd(r.collateral)} · entry {r.entry.toLocaleString()} · liq {r.liq.toLocaleString()}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function Limits({ me, token, run, busy, refresh }: Session) {
  const [policy, setPolicy] = useState(me.policy);
  const dirty = LIMITS.some(([k]) => policy[k] !== me.policy[k]);
  return (
    <Card title="Limits">
      <LimitFields value={policy} onChange={setPolicy} />
      <Button className="mt-3 w-full" disabled={!!busy || !dirty} onClick={() => run("Saving…", async () => { await api("/api/policy", token, policy); await refresh(); })}>
        {dirty ? "Save limits" : "Saved"}
      </Button>
    </Card>
  );
}

/** Hand a 30-day token to an MCP client or an x402-paying agent (e.g. the Bankr skill). */
export function Agents({ me, token, run, busy, signOut }: Session & { signOut: () => void }) {
  const [agent, setAgent] = useState<string | null>(null);
  const mcp = agent && JSON.stringify({ mcpServers: { agenthub: { type: "http", url: `${API}/mcp`, headers: { Authorization: `Bearer ${agent}` } } } }, null, 2);
  return (
    <Card title="Agents & channels">
      <ul className="mb-3 space-y-2 text-sm">
        <li className="flex items-center justify-between"><span>Telegram</span>
          {me.telegram ? <Pill tone="gain">linked</Pill> : <a href={BOT} className="text-mint hover:underline">Link →</a>}</li>
        <li className="flex items-center justify-between"><span>MCP · Claude, Cursor</span><span className="font-mono text-xs text-mute">{API.replace("https://", "")}/mcp</span></li>
        <li className="flex items-center justify-between"><span>Bankr skill · x402</span><span className="text-xs text-mute">$0.01 / executed trade</span></li>
      </ul>
      {!agent ? (
        <Button variant="ghost" className="w-full" disabled={!!busy} onClick={() => run("Creating token…", async () => setAgent((await api("/api/agent/token", token, {})).token))}>
          Create agent token
        </Button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-warn">Treat it like a password: it can trade for you (never withdraw) for 30 days or until revoked.</p>
          <textarea readOnly rows={8} value={mcp!} onFocus={(e) => e.target.select()} className={`${input} font-mono text-xs`} />
          <Button variant="ghost" className="w-full" onClick={() => navigator.clipboard?.writeText(mcp!)}>Copy MCP config</Button>
        </div>
      )}
      <button className="mt-3 text-xs text-loss hover:underline disabled:opacity-50" disabled={!!busy}
        onClick={() => run("Revoking…", async () => { await api("/api/agent/revoke", token, {}); signOut(); })}>
        Revoke all tokens (signs you out everywhere)
      </button>
    </Card>
  );
}
