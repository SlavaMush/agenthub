import { NextRequest, NextResponse } from "next/server";

// Phase-1 stub: parse intent, compute an estimated quote, return confirm link
// that deep-links into Telegram bot for execution.

type Intent = {
  action: "open" | "close";
  side?: "long" | "short";
  pair?: string;             // "ETH", "BTC", "SOL"
  collateral?: number;       // USD
  leverage?: number;         // 1..100
  sl_pct?: number;           // 0..100 (% stop)
} | null;

const PAIR_RE = /(ETH|BTC|SOL|USDC|AVAX|ARB|BASE|HYPE|DOGE|LINK|XRP)/i;
const LEV_RE = /(\d+)\s*x/;
const USD_RE = /\$?\s*(\d+(?:\.\d+)?)\s*(?:usd|dollars|usdc)?/i;
const SL_RE = /(\d+)\s*%\s*stop/i;

const TELEGRAM_BOT = "tradr_aibot";
const DEFAULT_MAX_LEV = 3; // user's actual policy lives in bot; Phase 1 preview uses default cap

function parseIntent(text: string): Intent {
  const t = text.toLowerCase();
  const closeRe = /\b(close|flatten|exit|stop)\b/;
  if (closeRe.test(t)) return { action: "close" };

  const longRe = /\b(long|buy|up|bull)\b/;
  const shortRe = /\b(short|sell|down|bear)\b/;
  const pairM = t.match(PAIR_RE);
  const levM = t.match(LEV_RE);
  const usdM = t.match(USD_RE);
  const slM = t.match(SL_RE);

  if (!pairM || !usdM) return null;
  const side: "long" | "short" | undefined = longRe.test(t) ? "long" : shortRe.test(t) ? "short" : undefined;
  if (!side) return null;

  return {
    action: "open",
    side,
    pair: pairM[1].toUpperCase(),
    collateral: parseFloat(usdM[1]),
    leverage: levM ? Math.min(parseInt(levM[1], 10), DEFAULT_MAX_LEV) : DEFAULT_MAX_LEV,
    sl_pct: slM ? parseInt(slM[1], 10) : undefined,
  };
}

function renderQuote(i: Intent): { text: string; ok: boolean; reason?: string } {
  if (!i) return { text: "Couldn't parse.", ok: false, reason: "unparseable" };
  if (i.action === "close") {
    return { text: "Close all open positions.", ok: true };
  }
  const lev = i.leverage ?? DEFAULT_MAX_LEV;
  const coll = i.collateral ?? 0;
  const notional = coll * lev;
  const openFeePct = 0.06; // 6 bps near-verbatim from Veranta docs
  const openFeeUsd = (notional * openFeePct) / 100;
  const estLiq = i.side === "long" ? -95 / lev : +95 / lev; // crude % move approximation
  const sl = i.sl_pct ? `${i.sl_pct}%` : "not specified";
  return {
    text: `${i.side?.toUpperCase()} $${coll} ${i.pair} ${lev}x
Notional: $${notional.toFixed(2)} · Open fee: $${openFeeUsd.toFixed(2)}
Est. liquidation: ${estLiq > 0 ? "+" : ""}${estLiq.toFixed(1)}% away
Stop-loss: ${sl}`,
    ok: true,
  };
}

function botDeepLink(intent: Intent): string {
  if (!intent) return `https://t.me/${TELEGRAM_BOT}`;
  if (intent.action === "close") return `https://t.me/${TELEGRAM_BOT}?start=close`;
  const msg = `${intent.side} $${intent.collateral} ${intent.pair} ${intent.leverage}x${intent.sl_pct ? ` with ${intent.sl_pct}% stop` : ""}`;
  return `https://t.me/${TELEGRAM_BOT}?text=${encodeURIComponent(msg)}`;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { text?: string };
  const text = (body.text || "").trim();
  if (!text) return NextResponse.json({ reply: "Empty message." }, { status: 400 });

  const intent = parseIntent(text);
  const q = renderQuote(intent);

  if (!intent || !q.ok) {
    return NextResponse.json({
      reply:
        "I didn't catch that. Try: `long $100 ETH 5x` or `close my position`. " +
        "Full trade execution lives in Telegram — click below when you've got a quote.",
      deeplink: botDeepLink(null),
    });
  }

  return NextResponse.json({
    reply: q.text,
    intent,
    deeplink: botDeepLink(intent),
    note: "Tap Open in Telegram to execute. The agent will sign the trade with your delegated key.",
  });
}
