"use client";

import { useEffect, useRef, useState } from "react";
import { api, type Session } from "@/lib/agenthub";
import { Button, Pill } from "./ui";

type Msg = { me: boolean; text: string; token?: string | null; done?: boolean };
const CHIPS = ["long $20 ETH 5x sl 5%", "short $50 BTC 3x limit 90000", "close 50% ETH", "set sl ETH 2400", "cancel orders", "close everything"];

/** Agent replies are plain text; a "Blocked:" section lists every reason a trade can't go through. */
function Reply({ m, onExecute, onCancel, busy }: { m: Msg; onExecute: () => void; onCancel: () => void; busy: boolean }) {
  const [body, blocked] = m.text.split("Blocked:");
  const [head, ...rest] = body.trim().split("\n");
  const isQuote = !!m.token || !!blocked;
  return (
    <div className={`max-w-[92%] animate-rise rounded-2xl rounded-bl-md border border-line bg-card px-4 py-3 text-sm ${isQuote ? "w-full sm:w-auto sm:min-w-80" : ""}`}>
      <p className={isQuote ? "font-semibold" : "whitespace-pre-wrap text-dim"}>{head}</p>
      {rest.length > 0 && <div className="mt-1.5 space-y-0.5 font-mono text-xs text-dim">{rest.map((l) => <p key={l}>{l}</p>)}</div>}
      {blocked && (
        <div className="mt-3 rounded-xl border border-loss/25 bg-loss/5 p-3 text-xs text-loss">
          <b className="uppercase tracking-wider">Blocked</b>
          <ul className="mt-1 space-y-1">{blocked.split("•").map((b) => b.trim()).filter(Boolean).map((b) => <li key={b}>• {b}</li>)}</ul>
        </div>
      )}
      {m.token && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button onClick={onExecute} disabled={busy}>Execute</Button>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      )}
      {m.done && <div className="mt-2"><Pill tone="neutral">quote closed</Pill></div>}
    </div>
  );
}

export default function Console({ me, token, run, busy, refresh }: Session) {
  const [log, setLog] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [log, busy]);

  const say = (m: Msg) => setLog((l) => [...l.slice(-40), m]);
  const close = (t: string) => setLog((l) => l.map((m) => (m.token === t ? { ...m, token: null, done: true } : m)));
  const send = (msg = text) => msg.trim() && run("Thinking…", async () => {
    say({ me: true, text: msg });
    setText("");
    const r = await api("/api/chat", token, { text: msg });
    say({ me: false, text: r.reply, token: r.token });
  });
  const execute = (t: string) => run("Executing on Veranta…", async () => {
    close(t);
    say({ me: false, text: (await api("/api/confirm", token, { token: t })).reply });
    await refresh();
  });

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col rounded-2xl border border-line bg-panel/80">
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className={`h-2 w-2 rounded-full ${me.active && !me.paused ? "bg-gain" : "bg-warn"}`} /> Agent
        </div>
        <Pill tone={me.paused ? "warn" : me.active ? "gain" : "neutral"}>{me.paused ? "paused" : me.active ? "live" : "setup needed"}</Pill>
      </header>

      <div className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-4">
        {!log.length && (
          <div className="mx-auto max-w-md py-8 text-center">
            <p className="text-lg font-semibold">What do you want to trade?</p>
            <p className="mt-1 text-sm text-dim">Quotes are checked against Veranta&apos;s rules and your limits. Nothing executes until you tap Execute.</p>
          </div>
        )}
        {log.map((m, i) => m.me
          ? <p key={i} className="ml-auto w-fit max-w-[85%] animate-rise whitespace-pre-wrap rounded-2xl rounded-br-md bg-mint/15 px-4 py-2 text-sm">{m.text}</p>
          : <div key={i}><Reply m={m} busy={!!busy} onExecute={() => execute(m.token!)} onCancel={() => close(m.token!)} /></div>)}
        {busy && <p className="w-fit animate-pulse rounded-2xl border border-line bg-card px-4 py-2 text-sm text-dim">{busy}</p>}
        <div ref={end} />
      </div>

      <div className="border-t border-line p-3">
        <div className="scrollbar-thin mb-2 flex gap-2 overflow-x-auto pb-1">
          {CHIPS.map((c) => (
            <button key={c} onClick={() => send(c)} disabled={!!busy}
              className="shrink-0 rounded-full border border-line px-3 py-1 font-mono text-xs text-dim transition hover:border-mint/40 hover:text-white disabled:opacity-50">
              {c}
            </button>
          ))}
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={me.active ? "Ask the agent to trade…" : "Enable the agent to start trading"}
            className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-4 py-3 text-base outline-none transition placeholder:text-mute focus:border-mint/70" />
          <Button type="submit" disabled={!!busy || !text.trim()} className="px-5">Send</Button>
        </form>
      </div>
    </div>
  );
}
