"use client";

import { useState } from "react";
import Link from "next/link";
import { ServicesTab } from "@/components/ServicesTab";
import { MemoryTab } from "@/components/MemoryTab";
import { AgentsTab } from "@/components/AgentsTab";
import { ConnectMenu } from "@/components/ConnectMenu";
import { CatalogStatus } from "@/components/CatalogStatus";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"services" | "memory" | "agents">("services");

  const tabs = [
    { id: "services", label: "/services", desc: "Hire agents" },
    { id: "memory", label: "/memory", desc: "Buy/sell Sibyl Memory" },
    { id: "agents", label: "/agents", desc: "ERC-8004 directory" },
  ] as const;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border px-6 py-4 sticky top-0 bg-bg/80 backdrop-blur-sm z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-mint flex items-center justify-center">
              <svg className="w-6 h-6 text-bg" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-semibold text-xl tracking-tight">AgentHub</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl transition-all ${
                  activeTab === tab.id
                    ? "bg-mint/10 border border-mint/30 text-mint"
                    : "text-text-muted hover:text-text hover:bg-bg-elevated border border-transparent"
                }`}
              >
                <span className="font-mono text-sm font-medium">{tab.label}</span>
                <span className="text-xs text-text-muted">{tab.desc}</span>
              </button>
            ))}
          </nav>

          <ConnectMenu />
        </div>
        <div className="md:hidden max-w-7xl mx-auto flex gap-2 pt-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-3 py-2 rounded-xl text-xs font-mono ${
                activeTab === tab.id ? "bg-mint/10 text-mint border border-mint/30" : "text-text-muted border border-border"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        <CatalogStatus />
        {activeTab === "services" && <ServicesTab />}
        {activeTab === "memory" && <MemoryTab />}
        {activeTab === "agents" && <AgentsTab />}
      </main>

      <footer className="border-t border-border px-6 py-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-text-muted text-sm">
          <p>AgentHub — Agent-to-Agent Marketplace on Base 🏁</p>
          <div className="flex items-center gap-6">
            <a href="https://github.com/sibyllabs/agenthub" target="_blank" rel="noopener" className="hover:text-mint transition-colors">
              GitHub
            </a>
            <a href="https://x.com/DRVNlabo" target="_blank" rel="noopener" className="hover:text-mint transition-colors">
              X
            </a>
            <a href="https://sibylcap.com" target="_blank" rel="noopener" className="hover:text-mint transition-colors">
              SIBYL
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
