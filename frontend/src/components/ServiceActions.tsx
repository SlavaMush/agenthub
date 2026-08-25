"use client";

import { useState } from "react";
import { sameAddr } from "@/lib/format";
import { deadlinePassed } from "@/lib/jobUi";
import type { ServiceListing } from "@/lib/catalog";
import { useMarketplace } from "@/lib/useMarketplace";
import { txUrl } from "@/lib/app-config";
import { useToast } from "@/components/Toast";
import { PayButton, UsdcBalance } from "@/components/ConnectToAct";
import { Button, Field, inputClass } from "@/components/ui";

export function ServiceActions({
  detail,
  onSettled,
  layout = "stack",
}: {
  detail: ServiceListing;
  onSettled?: () => void;
  layout?: "stack" | "row";
}) {
  const market = useMarketplace();
  const toast = useToast();
  const [deliveryCid, setDeliveryCid] = useState("");
  const isSeller = sameAddr(market.address, detail.seller);
  const isBuyer = sameAddr(market.address, detail.buyer);
  const isParty = isSeller || isBuyer;
  const pastDeadline = deadlinePassed(detail.deadline);
  const wrap = layout === "stack" ? "space-y-2" : "flex flex-wrap gap-2";

  async function run(title: string, fn: () => Promise<`0x${string}`>) {
    try {
      const hash = await fn();
      toast.push({ tone: "ok", title, href: txUrl(hash) });
      onSettled?.();
    } catch (err) {
      toast.push({ tone: "warn", title: err instanceof Error ? err.message : "Transaction failed" });
    }
  }

  return (
    <div className="space-y-3">
      {detail.status === "Funded" && isSeller && !pastDeadline && (
        <Field label="Result CID" hint="IPFS CID of the deliverable. Must be posted before the deadline.">
          <input
            value={deliveryCid}
            onChange={(e) => setDeliveryCid(e.target.value)}
            placeholder="bafy…"
            className={inputClass()}
          />
        </Field>
      )}
      <div className={wrap}>
        {detail.status === "Listed" && !isSeller && (
          <>
            {layout === "stack" && <UsdcBalance className="block text-center" />}
            <PayButton
              className={layout === "stack" ? "w-full" : undefined}
              connected={market.isConnected}
              pending={market.isPending}
              disconnectedLabel="Connect to hire"
              onClick={() => run(`Job #${detail.id} funded.`, () => market.fundService(detail.id, detail.priceUSDC))}
            >
              Hire — pay into escrow
            </PayButton>
          </>
        )}
        {detail.status === "Listed" && isSeller && (
          <p className="text-xs text-text-muted">Waiting for a buyer to hire. Share this job URL.</p>
        )}
        {detail.status === "Funded" && isSeller && !pastDeadline && (
          <Button
            className={layout === "stack" ? "w-full" : undefined}
            disabled={market.isPending || !deliveryCid.trim()}
            onClick={() => run(`Job #${detail.id} delivered.`, () => market.deliverService(detail.id, deliveryCid.trim()))}
          >
            Deliver result
          </Button>
        )}
        {detail.status === "Funded" && isSeller && pastDeadline && (
          <p className="text-xs text-text-muted">Deadline passed. The buyer can claim USDC back.</p>
        )}
        {detail.status === "Delivered" && isBuyer && (
          <Button
            className={layout === "stack" ? "w-full" : undefined}
            disabled={market.isPending}
            onClick={() => run(`Job #${detail.id} confirmed.`, () => market.confirmService(detail.id))}
          >
            Confirm and pay seller
          </Button>
        )}
        {detail.status === "Delivered" && (
          <Button
            variant="ghost"
            className={layout === "stack" ? "w-full" : undefined}
            disabled={market.isPending}
            onClick={() => run(`Job #${detail.id} released.`, () => market.autoReleaseService(detail.id))}
          >
            Auto-release (3 days after delivery)
          </Button>
        )}
        {detail.status === "Funded" && isBuyer && pastDeadline && (
          <Button
            className={layout === "stack" ? "w-full" : undefined}
            disabled={market.isPending}
            onClick={() => run(`Job #${detail.id} refunded.`, () => market.refundService(detail.id))}
          >
            Claim USDC back
          </Button>
        )}
        {(detail.status === "Funded" || detail.status === "Delivered") && isParty && (
          <Button
            variant="danger"
            className={layout === "stack" ? "w-full" : undefined}
            disabled={market.isPending}
            onClick={() => run(`Job #${detail.id} frozen.`, () => market.freezeService(detail.id))}
          >
            Freeze dispute
          </Button>
        )}
        {detail.status === "Frozen" && (
          <p className="text-xs text-amber-200">Frozen — the protocol owner resolves payout or refund.</p>
        )}
      </div>
    </div>
  );
}
