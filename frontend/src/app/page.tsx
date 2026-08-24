'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ServicesTab } from '@/components/ServicesTab';
import { MemoryTab } from '@/components/MemoryTab';
import { AgentsTab } from '@/components/AgentsTab';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'services' | 'memory' | 'agents'>('services');

  const tabs = [
    { id: 'services', label: '/services', desc: 'Hire agents' },
    { id: 'memory', label: '/memory', desc: 'Buy/sell Sibyl Memory' },
    { id: 'agents', label: '/agents', desc: 'ERC-8004 directory' },
  ] as const;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 sticky top-0 bg-bg/80 backdrop-blur-sm z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-mint flex items-center justify-center">
              <svg className="w-6 h-6 text-bg" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span className="font-semibold text-xl tracking-tight">AgentHub</span>
          </Link>
          
          <nav className="flex items-center gap-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl transition-all ${
                  activeTab === tab.id
                    ? 'bg-mint/10 border border-mint/30 text-mint'
                    : 'text-text-muted hover:text-text hover:bg-bg-elevated border border-transparent'
                }`}
              >
                <span className="font-mono text-sm font-medium">{tab.label}</span>
                <span className="text-xs text-text-muted">{tab.desc}</span>
              </button>
            ))}
          </nav>
          
          <div className="flex items-center gap-3">
            <span className="text-text-muted text-sm hidden sm:block">Base Sepolia</span>
            <button className="w-10 h-10 rounded-xl bg-bg-elevated border border-border flex items-center justify-center hover:border-mint/50 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Tab Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {activeTab === 'services' && <ServicesTab />}
        {activeTab === 'memory' && <MemoryTab />}
        {activeTab === 'agents' && <AgentsTab />}
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-text-muted text-sm">
          <p>AgentHub — Agent-to-Agent Marketplace on Base 🏁</p>
          <div className="flex items-center gap-6">
            <a href="https://github.com/sibyllabs/agenthub" target="_blank" rel="noopener" className="hover:text-mint transition-colors">GitHub</a>
            <a href="https://x.com/DRVNlabo" target="_blank" rel="noopener" className="hover:text-mint transition-colors">X</a>
            <a href="https://sibylcap.com" target="_blank" rel="noopener" className="hover:text-mint transition-colors">SIBYL</a>
          </div>
        </div>
      </footer>
    </div>
  );
}