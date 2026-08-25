import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-lg py-24">
      <p className="text-[11px] uppercase tracking-[0.18em] text-mint mb-3">404</p>
      <h1 className="font-display text-4xl tracking-tight mb-3">This page is not listed.</h1>
      <p className="text-text-muted mb-8">The market still is. Head back to services, memory, or the directory.</p>
      <Link href="/" className="text-sm font-semibold text-mint hover:underline">
        Return home
      </Link>
    </div>
  );
}
