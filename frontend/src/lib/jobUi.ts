import { DEFAULT_FEES } from "@agenthub/config";
import type { MemoryListing, ServiceListing } from "./catalog";
import { parseListingUri } from "./uris";
import { formatUsdc } from "./app-config";

export const CONFIRM_GRACE_DAYS = 3;

export const SERVICE_STEPS = ["Listed", "Funded", "Delivered", "Completed"] as const;

export function listingBrief(item: { brief?: string; uri?: string }): string {
  if (item.brief?.trim()) return item.brief.trim();
  return parseListingUri(item.uri || "").brief;
}

export function formatWindow(durationSec: number): string {
  if (durationSec < 3600) return `${Math.max(1, Math.round(durationSec / 60))} min`;
  if (durationSec < 86400) {
    const h = durationSec / 3600;
    return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
  }
  const d = durationSec / 86400;
  return Number.isInteger(d) ? `${d}d` : `${d.toFixed(1)}d`;
}

export function deadlineMs(deadline: number | undefined): number | null {
  if (!deadline) return null;
  return deadline > 1e12 ? deadline : deadline * 1000;
}

export function deadlinePassed(deadline: number | undefined, now = Date.now()): boolean {
  const ms = deadlineMs(deadline);
  return ms != null && now >= ms;
}

export function formatDeadline(deadline: number | undefined): string | null {
  const ms = deadlineMs(deadline);
  if (ms == null) return null;
  return new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function windowLabel(row: ServiceListing): string {
  const ms = deadlineMs(row.deadline);
  if (ms == null) return "";
  const remaining = Math.max(0, ms - Date.now());
  if (row.status === "Listed") {
    if (remaining <= 0) return "Hire window closed";
    return `${formatWindow(remaining / 1000)} to fund`;
  }
  if (row.status === "Funded") {
    if (remaining <= 0) return "Deadline passed — buyer can refund";
    return `Deliver by ${formatDeadline(row.deadline)}`;
  }
  if (row.status === "Delivered") {
    return `Confirm, or USDC auto-releases ${CONFIRM_GRACE_DAYS} days after delivery`;
  }
  return formatDeadline(row.deadline) || "";
}

export function serviceFeeHint(priceAtomic: string): string {
  const pct = DEFAULT_FEES.serviceBps / 100;
  return `${pct}% protocol fee comes out of escrow on completion — you pay ${formatUsdc(priceAtomic)} USDC, the agent receives the rest.`;
}

export function memoryFeeHint(priceAtomic: string): string {
  const pct = DEFAULT_FEES.memoryBps / 100;
  return `${pct}% protocol fee comes out of the sale — you pay ${formatUsdc(priceAtomic)} USDC.`;
}

export type NeedKind = "deliver" | "confirm" | "refund" | "frozen";

export function serviceNeedsYou(row: ServiceListing, me: string | undefined): NeedKind | null {
  if (!me) return null;
  const mine = me.toLowerCase();
  const seller = row.seller.toLowerCase();
  const buyer = row.buyer?.toLowerCase();
  if (row.status === "Frozen" && (seller === mine || buyer === mine)) return "frozen";
  if (row.status === "Funded" && seller === mine) return "deliver";
  if (row.status === "Delivered" && buyer === mine) return "confirm";
  if (row.status === "Funded" && buyer === mine && deadlinePassed(row.deadline)) return "refund";
  return null;
}

export function needLabel(kind: NeedKind): string {
  switch (kind) {
    case "deliver":
      return "Deliver a CID";
    case "confirm":
      return "Confirm or wait 3 days";
    case "refund":
      return "Claim USDC back";
    case "frozen":
      return "Frozen — wait for resolve";
  }
}

export function isInProgress(row: ServiceListing): boolean {
  return row.status === "Listed" || row.status === "Funded" || row.status === "Delivered" || row.status === "Frozen";
}

export function isDone(row: ServiceListing): boolean {
  return row.status === "Completed" || row.status === "Refunded" || row.status === "Cancelled";
}

export function memoryForSale(row: MemoryListing, me: string | undefined): boolean {
  if (!me) return false;
  return Boolean(row.active) && !row.sold && row.seller.toLowerCase() === me.toLowerCase();
}
