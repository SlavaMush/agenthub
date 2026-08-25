import Link from "next/link";

export function StoryRail({
  kicker = "User stories",
  items,
}: {
  kicker?: string;
  items: { href: string; title: string }[];
}) {
  return (
    <nav className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
      <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted shrink-0">{kicker}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Link
            key={item.href + item.title}
            href={item.href}
            className="h-8 px-3 rounded-full border border-white/10 text-xs text-text-muted hover:text-mint hover:border-mint/40 inline-flex items-center"
          >
            {item.title}
          </Link>
        ))}
      </div>
    </nav>
  );
}
