"use client";

import { FormEvent, type ReactNode, useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { agentHubAbi } from "@agenthub/config";
import { contracts, hasContract, txUrl } from "@/lib/app-config";
import { buildAgentUri } from "@/lib/uris";
import { useMarketplace } from "@/lib/useMarketplace";
import { useToast } from "@/components/Toast";
import { ConnectToAct } from "@/components/ConnectToAct";
import { Button, Field, inputClass } from "@/components/ui";

export function useIsAgent() {
  const { address, isConnected } = useAccount();
  const query = useReadContract({
    address: contracts.agentHub,
    abi: agentHubAbi,
    functionName: "isAgent",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && hasContract(contracts.agentHub)) },
  });
  return {
    isConnected,
    isAgent: query.data === true,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

/** Blocks listing until the wallet owns an ERC-8004 identity. Mint happens in-place. */
export function IdentityGate({ children }: { children: ReactNode }) {
  const { isConnected, isAgent, isLoading, refetch } = useIsAgent();
  const market = useMarketplace();
  const toast = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function onMint(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      const hash = await market.registerAgent(buildAgentUri({ name, description }));
      toast.push({ tone: "ok", title: "Identity minted.", href: txUrl(hash) });
      await refetch();
    } catch (err) {
      toast.push({ tone: "warn", title: err instanceof Error ? err.message : "Mint failed" });
    }
  }

  if (!isConnected) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-text-muted">Connect a wallet, then mint an ERC-8004 identity to list.</p>
        <ConnectToAct label="Connect to list" className="w-full" />
      </div>
    );
  }

  if (isLoading && !isAgent) {
    return <p className="text-sm text-text-muted">Checking identity…</p>;
  }

  if (!isAgent) {
    return (
      <form onSubmit={onMint} className="space-y-4">
        <div className="rounded-2xl border border-mint/20 bg-mint/5 p-3 text-sm">
          <p className="font-medium text-mint mb-1">Mint identity first</p>
          <p className="text-text-muted text-xs leading-relaxed">
            Listing requires an ERC-8004 NFT on this wallet. Name and a one-line description are enough. You can expand the profile later on Agents.
          </p>
        </div>
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Auditor" className={inputClass()} />
        </Field>
        <Field label="What you do">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            placeholder="Solidity review. Delivers a markdown report CID."
            className={inputClass()}
          />
        </Field>
        <Button type="submit" disabled={market.isPending} className="w-full">
          Mint identity
        </Button>
      </form>
    );
  }

  return <>{children}</>;
}
