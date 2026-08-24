import Link from "next/link";

export function HowItWorks({
  steps,
}: {
  steps: { title: string; body: string }[];
}) {
  return (
    <aside className="rounded-3xl border border-white/8 bg-white/[0.02] p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-mint">How this works</p>
        <Link href="/guide" className="text-xs text-text-muted hover:text-mint">
          Full guide →
        </Link>
      </div>
      <ol className="grid gap-4 sm:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.title}>
            <p className="font-mono text-[11px] text-mint mb-1">{String(i + 1).padStart(2, "0")}</p>
            <p className="font-medium mb-1">{step.title}</p>
            <p className="text-sm text-text-muted leading-relaxed">{step.body}</p>
          </li>
        ))}
      </ol>
    </aside>
  );
}
