"use client";

import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { hueFromAddress, statusTone } from "@/lib/format";

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md";
}) {
  const styles = {
    primary:
      "bg-gradient-mint text-bg shadow-[0_0_0_1px_rgba(0,218,162,0.35),0_8px_24px_rgba(0,218,162,0.18)] hover:brightness-110",
    ghost: "bg-white/[0.03] text-text border border-white/10 hover:border-mint/40 hover:bg-mint/5",
    danger: "bg-amber-500/15 text-amber-200 border border-amber-500/30 hover:bg-amber-500/25",
  }[variant];
  const sizing = size === "sm" ? "h-9 px-3.5 text-xs" : "h-10 px-4 text-sm";
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition duration-200 disabled:pointer-events-none disabled:opacity-40 ${sizing} ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] uppercase tracking-[0.14em] text-text-muted font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-text-muted">{hint}</span>}
    </label>
  );
}

export function inputClass(extra = "") {
  return `w-full h-11 px-3.5 rounded-xl bg-black/25 border border-white/10 text-sm text-text placeholder:text-text-muted/70 outline-none transition focus:border-mint/50 focus:ring-2 focus:ring-mint/20 ${extra}`;
}

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6">
      <button aria-label="Close dialog" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#0d1512] shadow-[0_24px_80px_rgba(0,0,0,0.55)] p-6 sm:p-7 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15 sm:hidden" />
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 id="dialog-title" className="font-display text-2xl tracking-tight">
              {title}
            </h2>
            {subtitle && <p className="text-sm text-text-muted mt-1">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text h-8 w-8 rounded-full border border-white/10">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({
  kicker,
  title,
  body,
  action,
}: {
  kicker: string;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/8 bg-white/[0.02] px-8 py-16 text-center">
      <div className="pointer-events-none absolute inset-0 opacity-60 bg-[radial-gradient(600px_circle_at_50%_0%,rgba(0,218,162,0.12),transparent_55%)]" />
      <div className="relative">
        <div className="mx-auto mb-5 h-12 w-12 rounded-2xl bg-mint/10 border border-mint/25 flex items-center justify-center text-mint">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
            <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
          </svg>
        </div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-mint mb-2">{kicker}</p>
        <h3 className="font-display text-2xl mb-2">{title}</h3>
        <p className="text-sm text-text-muted max-w-md mx-auto mb-6">{body}</p>
        {action}
      </div>
    </div>
  );
}

export function SkeletonGrid({ n = 3 }: { n?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="rounded-3xl border border-white/8 bg-white/[0.03] p-5 animate-pulse">
          <div className="h-3 w-16 rounded bg-white/10 mb-6" />
          <div className="h-5 w-3/4 rounded bg-white/10 mb-3" />
          <div className="h-3 w-1/2 rounded bg-white/8 mb-8" />
          <div className="h-8 w-24 rounded bg-white/10" />
        </div>
      ))}
    </div>
  );
}

export function Notice({ tone = "muted", children }: { tone?: "muted" | "ok" | "warn"; children: ReactNode }) {
  const cls =
    tone === "ok"
      ? "border-mint/30 bg-mint/10 text-mint"
      : tone === "warn"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
        : "border-white/10 bg-white/[0.03] text-text-muted";
  return <div className={`rounded-2xl border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

export async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="font-mono text-[11px] text-text-muted hover:text-mint"
      onClick={async (e) => {
        e.stopPropagation();
        await copyText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

export function Badge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-[10px] uppercase tracking-[0.14em] border ${statusTone(status)}`}>
      {status}
    </span>
  );
}

export function Price({ atomic, size = "lg" }: { atomic: string | number; size?: "lg" | "xl" }) {
  const n = Number(atomic) / 1e6;
  const formatted = Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "0.00";
  return (
    <div className="leading-none">
      <span className={`font-mono tracking-tight text-mint ${size === "xl" ? "text-3xl" : "text-xl"}`}>${formatted}</span>
      <span className="ml-1.5 text-[11px] uppercase tracking-[0.12em] text-text-muted">USDC</span>
    </div>
  );
}

export function Identicon({ address, size = 40 }: { address: string; size?: number }) {
  const hue = hueFromAddress(address);
  return (
    <div
      className="shrink-0 rounded-2xl border border-white/10"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, hsl(${hue} 58% 42%), hsl(${(hue + 48) % 360} 46% 18%))`,
      }}
    />
  );
}

export function ChipRow({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex p-1 rounded-full border border-white/10 bg-black/20 overflow-x-auto">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`h-8 px-3 rounded-full text-xs whitespace-nowrap transition ${
            value === option.id ? "bg-white text-bg font-semibold" : "text-text-muted hover:text-text"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function MarketHeader({
  kicker,
  title,
  description,
  children,
}: {
  kicker?: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
      <div>
        {kicker && <p className="text-[11px] uppercase tracking-[0.18em] text-mint mb-2">{kicker}</p>}
        <h1 className="font-display text-3xl sm:text-4xl tracking-tight">{title}</h1>
        <p className="text-sm text-text-muted mt-2 max-w-xl">{description}</p>
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </div>
  );
}
