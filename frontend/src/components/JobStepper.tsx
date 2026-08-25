"use client";

import { SERVICE_STEPS } from "@/lib/jobUi";

const LABELS: Record<(typeof SERVICE_STEPS)[number], string> = {
  Listed: "Listed",
  Funded: "In escrow",
  Delivered: "Delivered",
  Completed: "Paid",
};

export function JobStepper({ status }: { status: string }) {
  const terminal = status === "Refunded" || status === "Cancelled" || status === "Frozen";
  const idx = SERVICE_STEPS.indexOf(status as (typeof SERVICE_STEPS)[number]);

  if (terminal) {
    const tone =
      status === "Frozen"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
        : "border-white/10 bg-white/[0.03] text-text-muted";
    return (
      <p className={`rounded-xl border px-3 py-2 text-xs font-medium ${tone}`}>
        {status === "Frozen" && "Frozen — settlement paused until the protocol owner resolves."}
        {status === "Refunded" && "Refunded — USDC returned to the buyer."}
        {status === "Cancelled" && "Cancelled — listing taken down before it was funded."}
      </p>
    );
  }

  return (
    <ol className="grid grid-cols-4 gap-1">
      {SERVICE_STEPS.map((step, i) => {
        const done = idx > i || status === "Completed";
        const current = idx === i;
        return (
          <li
            key={step}
            className={`rounded-lg border px-1.5 py-2 text-center text-[10px] font-semibold uppercase tracking-wide sm:text-[11px] ${
              done || current ? "border-mint/40 bg-mint/10 text-mint" : "border-white/10 bg-white/[0.03] text-text-muted"
            }`}
          >
            {LABELS[step]}
          </li>
        );
      })}
    </ol>
  );
}
