import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export const input =
  "w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-base text-white outline-none transition placeholder:text-mute focus:border-mint/70";

export function Button({ variant = "primary", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const look = {
    primary: "bg-mint text-black hover:brightness-110 shadow-[0_8px_30px_-8px_rgb(0_218_162/0.6)]",
    ghost: "border border-line bg-white/[0.02] text-dim hover:border-mint/40 hover:text-white",
    danger: "border border-loss/30 bg-loss/5 text-loss hover:bg-loss/10",
  }[variant];
  return <button {...p} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${look} ${className}`} />;
}

export function Card({ title, action, children, className = "" }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`animate-rise rounded-2xl border border-line bg-card/80 p-4 backdrop-blur sm:p-5 ${className}`}>
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-mute">{title}</h3>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Pill({ tone = "neutral", children }: { tone?: "gain" | "loss" | "warn" | "neutral" | "mint"; children: ReactNode }) {
  const look = {
    gain: "bg-gain/10 text-gain border-gain/25", loss: "bg-loss/10 text-loss border-loss/25", warn: "bg-warn/10 text-warn border-warn/25",
    mint: "bg-mint/10 text-mint border-mint/25", neutral: "bg-white/5 text-dim border-line",
  }[tone];
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${look}`}>{children}</span>;
}

export function Dot({ on = true }: { on?: boolean }) {
  return <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-gain shadow-[0_0_8px] shadow-gain" : "bg-mute"}`} />;
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-mint to-gain text-xs font-bold text-black">A</span>
      AgentHub
    </Link>
  );
}
