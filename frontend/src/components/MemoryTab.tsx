'use client';

import { useState } from 'react';

export interface MemoryModule {
  id: number;
  title: string;
  description: string;
  moduleType: 'ENTITY_FILE' | 'SESSION_BRIDGE' | 'PRIORITY_INDEX';
  cid: string;
  priceUSDC: number;
  seller: string;
  sellerReputation: number;
  sellerTier: number;
  validationScore: number; // 0-1000 (956 = 95.6%)
  listedAt: number;
  sold: boolean;
}

const mockMemory: MemoryModule[] = [
  {
    id: 0,
    title: 'DeFi Protocol Entity File — Aerodrome',
    description: 'Complete entity file for Aerodrome Finance on Base. Includes pool addresses, gauge weights, bribe mechanics, vote-escrow logic, and historical TVL data. Schema v1. Validated against 95.6% LongMemEval benchmark.',
    moduleType: 'ENTITY_FILE',
    cid: 'QmX7k9p2R4vL8nM3qW6yT1uI5oP9aS2dF6gH8jK4lZ7x',
    priceUSDC: 150,
    seller: '0x742d...8a3f',
    sellerReputation: 942,
    sellerTier: 4,
    validationScore: 956,
    listedAt: Date.now() - 86400000 * 3,
    sold: false,
  },
  {
    id: 1,
    title: 'Session Bridge — Cross-Chain Arbitrage Agent',
    description: 'Session continuity module for agent operating across Base, Arbitrum, and Optimism. Preserves decision context, pending intents, and risk parameters across chain switches. 127 sessions validated.',
    moduleType: 'SESSION_BRIDGE',
    cid: 'QmZ9v2n5Q7wL1mM4rX8yU3iO6pA1sD4fG7hJ9kL5zX8c',
    priceUSDC: 80,
    seller: '0x1a3b...f2e1',
    sellerReputation: 887,
    sellerTier: 3,
    validationScore: 942,
    listedAt: Date.now() - 86400000 * 1,
    sold: false,
  },
  {
    id: 2,
    title: 'Priority Index — MEV Searcher Heuristics',
    description: 'Learned priority patterns for MEV extraction on Base. Gas estimation, bundle ordering, competitor modeling. Reduces missed opportunities by 34% in backtests. Priority index v1 schema.',
    moduleType: 'PRIORITY_INDEX',
    cid: 'QmY8x1m4P6vK9lN3qW7zT2uI4oP8aS1dF5gH7jK3lZ6x',
    priceUSDC: 300,
    seller: '0x5c6d...b1a9',
    sellerReputation: 823,
    sellerTier: 3,
    validationScore: 918,
    listedAt: Date.now() - 86400000 * 5,
    sold: false,
  },
  {
    id: 3,
    title: 'Entity File — Morpho Blue Markets',
    description: 'Complete Morpho Blue market data: LLTV, IRM configs, oracle addresses, capOracle, supply/borrow caps. Updated daily via Ping Protocol. 95.6% validation.',
    moduleType: 'ENTITY_FILE',
    cid: 'QmW6v3n7Q8xL2mN5rY9zU4iO7pA2sD5fG8hJ1kL6zX9c',
    priceUSDC: 120,
    seller: '0x9f8e...c4d2',
    sellerReputation: 756,
    sellerTier: 2,
    validationScore: 956,
    listedAt: Date.now() - 86400000 * 2,
    sold: false,
  },
  {
    id: 4,
    title: 'Session Bridge — Governance Delegate Agent',
    description: 'Maintains voting context, delegation chains, proposal history, and conviction scores across DAO sessions. Compatible with Governor Bravo, OZ Governor, and Tally.',
    moduleType: 'SESSION_BRIDGE',
    cid: 'QmV5u2m3P5wK8lM2qX7yT1uI3oP7aS0dF4gH6jK2lZ5x',
    priceUSDC: 60,
    seller: '0x3e4f...9d8c',
    sellerReputation: 912,
    sellerTier: 4,
    validationScore: 948,
    listedAt: Date.now() - 86400000 * 4,
    sold: false,
  },
  {
    id: 5,
    title: 'Priority Index — L2 Sequencer Fee Oracle',
    description: 'Real-time priority fee predictions for Base, Arbitrum, OP Mainnet. Includes blob fee modeling, congestion detection, and optimal tip calculation. Sub-100ms inference.',
    moduleType: 'PRIORITY_INDEX',
    cid: 'QmU4t1l2O4vJ7kM1qW6zS0uH2oN6aR9dE3gF5hJ1kL4z',
    priceUSDC: 200,
    seller: '0x8a7b...e5f4',
    sellerReputation: 894,
    sellerTier: 3,
    validationScore: 935,
    listedAt: Date.now() - 86400000 * 6,
    sold: true,
  },
];

const typeColors: Record<string, string> = {
  ENTITY_FILE: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  SESSION_BRIDGE: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  PRIORITY_INDEX: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

const typeIcons: Record<string, React.ReactNode> = {
  ENTITY_FILE: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  SESSION_BRIDGE: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
  PRIORITY_INDEX: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
};

export function MemoryTab() {
  const [filter, setFilter] = useState<'all' | 'ENTITY_FILE' | 'SESSION_BRIDGE' | 'PRIORITY_INDEX'>('all');
  
  const filtered = mockMemory.filter(m => {
    if (filter === 'all') return true;
    return m.moduleType === filter;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">/memory</h1>
          <p className="text-text-muted mt-1">Buy & sell Sibyl Memory modules — Entity Files, Session Bridges, Priority Indices. 10% protocol fee.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'ENTITY_FILE', 'SESSION_BRIDGE', 'PRIORITY_INDEX'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                filter === f
                  ? 'bg-mint/10 border border-mint/30 text-mint'
                  : 'bg-bg-elevated border border-border text-text-muted hover:border-mint/50 hover:text-text'
              }`}
            >
              {f === 'all' ? 'All' : f.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Active Listings" value={mockMemory.filter(m => !m.sold).length} />
        <StatCard label="Total Volume" value="≈$2.4k" />
        <StatCard label="Avg Validation" value="94.2%" />
        <StatCard label="Protocol Fees" value="≈$240" />
      </div>

      {/* Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(module => (
          <MemoryCard key={module.id} module={module} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-text-muted">
          No memory modules match your filter.
        </div>
      )}

      {/* CTA */}
      <div className="border border-mint/30 rounded-2xl p-8 text-center bg-mint/5">
        <h3 className="text-xl font-semibold mb-2">List your agent's memory</h3>
        <p className="text-text-muted mb-6 max-w-md mx-auto">Mint MemoryNFTs from your Sibyl Memory directory. Schema v1, 95.6% LongMemEval validated. 10% fee on sale.</p>
        <button className="px-6 py-3 rounded-xl bg-gradient-mint text-bg font-medium hover:opacity-90 transition-opacity">
          Mint Memory Module →
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-bg-elevated border border-border rounded-xl p-4">
      <div className="text-2xl font-bold text-mint font-mono">{value}</div>
      <div className="text-xs text-text-muted mt-1">{label}</div>
    </div>
  );
}

function MemoryCard({ module }: { module: MemoryModule }) {
  return (
    <div className={`bg-bg-elevated border border-border rounded-2xl p-6 hover:border-mint/50 transition-all ${module.sold ? 'opacity-60' : ''}`}>
      {/* Type Badge + Icon */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${typeColors[module.moduleType]}`}>
            {module.moduleType.replace('_', ' ')}
          </span>
        </div>
        <span className="text-xs text-text-muted font-mono">#{module.id}</span>
      </div>

      <div className="flex items-start gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${typeColors[module.moduleType].replace('text-', 'bg-').replace('border-', '')}`}>
          {typeIcons[module.moduleType]}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold mb-1 truncate">{module.title}</h3>
          <p className="text-text-muted text-sm line-clamp-2">{module.description}</p>
        </div>
      </div>

      {/* Validation Score */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-text-muted">Validation Score</span>
          <span className="font-mono font-semibold text-mint">{module.validationScore / 10}%</span>
        </div>
        <div className="h-2 bg-bg rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-mint rounded-full transition-all duration-500"
            style={{ width: `${module.validationScore / 10}%` }}
          />
        </div>
      </div>

      {/* Meta */}
      <div className="space-y-2 mb-4 text-sm">
        <div className="flex items-center gap-2 text-text-muted">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          <span className="font-mono truncate max-w-[120px]">{module.seller}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-mint/10 text-mint text-xs font-mono">Tier {module.sellerTier}</span>
          <span className="text-text-muted">Score: {module.sellerReputation}</span>
        </div>
        <div className="flex items-center gap-2 text-text-muted">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          <span className="font-mono text-xs truncate max-w-[200px]">CID: {module.cid.slice(0, 20)}...</span>
        </div>
      </div>

      {/* Price & Action */}
      <div className="border-t border-border pt-4 flex items-center justify-between">
        <div>
          <span className="text-text-muted text-xs">Price</span>
          <div className="font-mono text-xl font-semibold text-mint">{module.sold ? 'SOLD' : `${(module.priceUSDC / 1e6).toFixed(0)} USDC`}</div>
        </div>
        <button 
          disabled={module.sold}
          className={`px-5 py-2.5 rounded-xl font-medium transition-all ${module.sold ? 'bg-border text-text-muted cursor-not-allowed' : 'bg-gradient-mint text-bg hover:opacity-90'}`}
        >
          {module.sold ? 'Sold' : 'Buy Now'}
        </button>
      </div>
    </div>
  );
}