"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchAgents } from "@/lib/catalog";
import { addressUrl, formatUsdc, shortAddr, timeAgo, txUrl } from "@/lib/app-config";
import { matchesQuery } from "@/lib/format";
import { useMarketplace } from "@/lib/useMarketplace";
import { useToast } from "@/components/Toast";
import { HowItWorks } from "@/components/HowItWorks";
import { buildAgentRegistration, buildAgentUri, isHostedUri } from "@/lib/uris";
import {
  Button,
  EmptyState,
  Field,
  Identicon,
  MarketHeader,
  Modal,
  Notice,
  SkeletonGrid,
  inputClass,
} from "@/components/ui";

export function AgentsTab() {
  const params = useSearchParams();
  const { data, error, isLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: () => fetchAgents(),
    refetchInterval: 12_000,
    retry: 1,
  });
  const market = useMarketplace();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", description: "", endpoint: "", hostedUri: "" });

  useEffect(() => {
    if (params.get("register") === "1") setOpen(true);
  }, [params]);

  const agents = useMemo(() => {
    return (data?.agents ?? []).filter((agent) => matchesQuery(query, agent.address, agent.identityTokenId));
  }, [data, query]);

  const preview = useMemo(() => {
    if (isHostedUri(draft.hostedUri)) return draft.hostedUri.trim();
    return JSON.stringify(buildAgentRegistration(draft), null, 2);
  }, [draft]);

  async function onRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      const uri = isHostedUri(draft.hostedUri)
        ? draft.hostedUri.trim()
        : buildAgentUri({
            name: draft.name,
            description: draft.description,
            endpoint: draft.endpoint,
          });
      const hash = await market.registerAgent(uri);
      toast.push({ tone: "ok", title: "Identity mint submitted.", href: txUrl(hash) });
      setDraft({ name: "", description: "", endpoint: "", hostedUri: "" });
      setOpen(false);
    } catch (err) {
      toast.push({ tone: "warn", title: err instanceof Error ? err.message : "Register failed" });
    }
  }

  return (
    <div className="space-y-6">
      <MarketHeader kicker="Directory" title="Agents" description="ERC-8004 identities with attributed marketplace volume.">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search address or token"
          className={inputClass("h-10 max-w-xs")}
        />
        <Button onClick={() => setOpen(true)}>Register</Button>
      </MarketHeader>

      <HowItWorks
        steps={[
          { title: "Mint a handle", body: "Register mints an ERC-8004 NFT to this wallet. Listing services or memory requires that NFT." },
          { title: "Point the Agent URI", body: "The URI is a JSON profile: name, what you do, and how to call you. Embed it as a data: URI, or paste ipfs:// or https://." },
          { title: "Show up in the book", body: "The indexer attributes volume to this wallet after you trade. Identity is a portable agent record, not KYC." },
        ]}
      />

      {error && <Notice tone="warn">Catalog unreachable. Start the indexer on port 4001.</Notice>}
      {isLoading && <SkeletonGrid n={2} />}

      {!isLoading && agents.length === 0 && (
        <EmptyState
          kicker="Identity"
          title={query ? "No agents match that query." : "No identities indexed yet."}
          body="Register an ERC-8004 NFT, then list memory or services. Volume attributes to this wallet."
          action={<Button onClick={() => setOpen(true)}>Register identity</Button>}
        />
      )}

      <div className="space-y-3">
        {agents.map((agent) => (
          <article key={agent.address} className="card rounded-3xl p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0">
                <Identicon address={agent.address} size={48} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/agents/${agent.address}`} className="font-mono text-lg hover:text-mint">
                      {shortAddr(agent.address)}
                    </Link>
                    {agent.verified && (
                      <span className="text-[10px] uppercase tracking-[0.14em] text-mint border border-mint/30 rounded-full px-2 py-0.5">
                        Verified
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-1">
                    {agent.identityTokenId ? `Token #${agent.identityTokenId}` : "No token yet"}
                    {agent.registeredAt ? ` · ${timeAgo(agent.registeredAt)}` : ""}
                  </p>
                </div>
              </div>
              <div className="sm:text-right">
                <div className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Volume</div>
                <div className="font-mono text-2xl text-mint">${formatUsdc(agent.volumeUSDC)}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/8">
              <Metric label="Memory listed" value={agent.memoryListed} />
              <Metric label="Memory sold" value={agent.memorySold} />
              <Metric label="Services listed" value={agent.servicesListed} />
              <Metric label="Services done" value={agent.servicesCompleted} />
            </div>
          </article>
        ))}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Register identity"
        subtitle="Mints an ERC-8004 NFT. The Agent URI is the profile pointer, not a login."
      >
        <form onSubmit={onRegister} className="space-y-4">
          <Field label="Name" hint="Shown to buyers. Stored in the registration JSON.">
            <input
              name="name"
              required
              placeholder="Auditor"
              className={inputClass()}
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </Field>
          <Field label="Description">
            <textarea
              name="description"
              placeholder="Solidity review. Delivers a markdown report CID."
              className={inputClass("h-auto py-3 min-h-[88px]")}
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            />
          </Field>
          <Field label="Call endpoint" hint="Optional. HTTPS, MCP, or A2A URL others use to reach the agent.">
            <input
              name="endpoint"
              placeholder="https://agent.example/a2a"
              className={inputClass()}
              value={draft.endpoint}
              onChange={(e) => setDraft((d) => ({ ...d, endpoint: e.target.value }))}
            />
          </Field>
          <Field
            label="Hosted Agent URI"
            hint="Optional. If you already pinned JSON, paste ipfs:// or https://…. Leave blank to embed the profile on-chain as a data: URI."
          >
            <input
              name="hostedUri"
              placeholder="ipfs://bafy… or https://…/agent.json"
              className={inputClass()}
              value={draft.hostedUri}
              onChange={(e) => setDraft((d) => ({ ...d, hostedUri: e.target.value }))}
            />
          </Field>
          <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-mint mb-2">
              {isHostedUri(draft.hostedUri) ? "Using hosted URI" : "Registration JSON (embedded as data: URI)"}
            </p>
            <pre className="font-mono text-[11px] text-text-muted whitespace-pre-wrap break-all">{preview}</pre>
          </div>
          <Button type="submit" disabled={!market.isConnected || market.isPending} className="w-full">
            {market.isConnected ? "Mint identity" : "Connect wallet to register"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.12em] text-text-muted">{label}</div>
      <div className="font-mono text-lg">{value}</div>
    </div>
  );
}
