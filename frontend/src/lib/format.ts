export function hueFromAddress(address: string) {
  if (!address) return 158;
  let h = 0;
  for (let i = 2; i < Math.min(address.length, 10); i += 1) {
    h = (h * 17 + (parseInt(address[i], 16) || 0)) % 360;
  }
  return h;
}

export function statusTone(status: string) {
  switch (status) {
    case "Listed":
    case "active":
      return "text-mint bg-mint/10 border-mint/25";
    case "Funded":
      return "text-sky-200 bg-sky-400/10 border-sky-400/25";
    case "Delivered":
      return "text-amber-200 bg-amber-400/10 border-amber-400/25";
    case "Completed":
      return "text-emerald-200 bg-emerald-400/10 border-emerald-400/20";
    case "Refunded":
    case "Frozen":
    case "sold":
      return "text-text-muted bg-white/5 border-white/10";
    default:
      return "text-text-muted bg-white/5 border-white/10";
  }
}

export function sortListings<T extends { listedAt: number; priceUSDC: string }>(
  items: T[],
  sort: "new" | "price-asc" | "price-desc",
) {
  const copy = [...items];
  copy.sort((a, b) => {
    if (sort === "price-asc") return Number(a.priceUSDC) - Number(b.priceUSDC);
    if (sort === "price-desc") return Number(b.priceUSDC) - Number(a.priceUSDC);
    return (b.listedAt || 0) - (a.listedAt || 0);
  });
  return copy;
}

export function matchesQuery(query: string, ...fields: Array<string | number | null | undefined>) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((field) => String(field || "").toLowerCase().includes(q));
}

export function sameAddr(a?: string | null, b?: string | null) {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}
