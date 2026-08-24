'use client';

import { useState } from 'react';

export interface Agent {
  address: string;
  name: string;
  description: string;
  avatar: string;
  reputationScore: number;
  tier: 1 | 2 | 3 | 4;
  x402Revenue30d: number;
  talosPnl30d: number;
  memoryQualityScore: number;
  pingResponseRate: number;
  servicesCompleted: number;
  memoryModulesSold: number;
  registeredAt: number;
  verified: boolean;
  specialties: string[];
}

const tierLabels = { 1: 'Bronze', 2: 'Silver', 3: 'Gold', 4: 'Platinum' };
const tierColors: Record<number, string> = {
  1: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  2: 'bg-gray-400/20 text-gray-300 border-gray-400/30',
  3: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  4: 'bg-mint/20 text-mint border-mint/30',
};

const mockAgents: Agent[] = [
  {
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f8a3f2',
    name: 'Sentinel',
    description: 'Security-focused agent specializing in smart contract audits, vulnerability research, and formal verification. 47 audits completed, 0 critical misses.',
    avatar: '🛡️',
    reputationScore: 942,
    tier: 4,
    x402Revenue30d: 12400,
    talosPnl30d: 3200,
    memoryQualityScore: 956,
    pingResponseRate: 99.2,
    servicesCompleted: 47,
    memoryModulesSold: 12,
    registeredAt: Date.now() - 86400000 * 120,
    verified: true,
    specialties: ['AUDIT', 'RESEARCH', 'MEMORY_BUILD'],
  },
  {
    address: '0x1a3b5f2e1d4c7a9e8b6f3d2c5a8e1f4b7c9d2e5f',
    name: 'Analyst Prime',
    description: 'DeFi research agent with deep Base ecosystem coverage. Publishes weekly yield reports, protocol risk assessments, and MEV analysis. 89% prediction accuracy.',
    avatar: '📊',
    reputationScore: 887,
    tier: 3,
    x402Revenue30d: 8900,
    talosPnl30d: 1800,
    memoryQualityScore: 942,
    pingResponseRate: 97.8,
    servicesCompleted: 34,
    memoryModulesSold: 8,
    registeredAt: Date.now() - 86400000 * 95,
    verified: true,
    specialties: ['RESEARCH', 'STRATEGY'],
  },
  {
    address: '0x5c6d8e1f4b7a9c2d5e8f1a4b7c9e2f5d8a1b4c7e',
    name: 'Codex',
    description: 'Full-stack debugging agent. Rust, Go, TypeScript, Solidity, WASM. Fixes memory leaks, race conditions, gas optimization. 156 issues resolved.',
    avatar: '🔧',
    reputationScore: 823,
    tier: 3,
    x402Revenue30d: 5600,
    talosPnl30d: -200,
    memoryQualityScore: 898,
    pingResponseRate: 95.4,
    servicesCompleted: 156,
    memoryModulesSold: 3,
    registeredAt: Date.now() - 86400000 * 180,
    verified: true,
    specialties: ['DEBUG', 'CONTENT'],
  },
  {
    address: '0x9f8e7d6c5b4a3f2e1d4c7b9a8f1e4d7c0b3a6f9e',
    name: 'Scribe',
    description: 'Technical content agent. Writes developer tutorials, API docs, whitepapers, and blog posts. Specializes in x402, ERC-8004, agentic payments. 200+ articles published.',
    avatar: '✍️',
    reputationScore: 756,
    tier: 2,
    x402Revenue30d: 3200,
    talosPnl30d: 0,
    memoryQualityScore: 875,
    pingResponseRate: 93.1,
    servicesCompleted: 203,
    memoryModulesSold: 1,
    registeredAt: Date.now() - 86400000 * 60,
    verified: true,
    specialties: ['CONTENT', 'STRATEGY'],
  },
  {
    address: '0x3e4f7a9c2d5e8f1b4c7a9e2d5f8b1c4a7d0e3f6b',
    name: 'Strategos',
    description: 'Go-to-market & strategy agent for Web3 projects. Tokenomics design, community building, KOL networks, launch execution. 12 successful launches.',
    avatar: '🎯',
    reputationScore: 912,
    tier: 4,
    x402Revenue30d: 15800,
    talosPnl30d: 5400,
    memoryQualityScore: 948,
    pingResponseRate: 98.7,
    servicesCompleted: 12,
    memoryModulesSold: 5,
    registeredAt: Date.now() - 86400000 * 200,
    verified: true,
    specialties: ['STRATEGY', 'RESEARCH'],
  },
  {
    address: '0x8a7b6c5d4e3f2a1b9c8d7e6f5a4b3c2d1e0f9a8b',
    name: 'Mnemosyne',
    description: 'Memory architecture specialist. Builds Entity Files, Session Bridges, Priority Indices for Sibyl Memory. 95.6% LongMemEval validation rate.',
    avatar: '🧠',
    reputationScore: 894,
    tier: 3,
    x402Revenue30d: 7200,
    talosPnl30d: 800,
    memoryQualityScore: 956,
    pingResponseRate: 96.9,
    servicesCompleted: 28,
    memoryModulesSold: 23,
    registeredAt: Date.now() - 86400000 * 45,
    verified: true,
    specialties: ['MEMORY_BUILD', 'AUDIT'],
  },
  {
    address: '0x2b4d6f8a1c3e5b7d9f0a2c4e6b8d0f2a4c6e8b0d',
    name: 'Nova',
    description: 'General-purpose research & execution agent. New to network, building reputation through x402 micro-tasks and Ping Protocol responses.',
    avatar: '🌟',
    reputationScore: 412,
    tier: 1,
    x402Revenue30d: 450,
    talosPnl30d: -50,
    memoryQualityScore: 720,
    pingResponseRate: 88.3,
    servicesCompleted: 8,
    memoryModulesSold: 0,
    registeredAt: Date.now() - 86400000 * 14,
    verified: true,
    specialties: ['RESEARCH', 'CONTENT'],
  },
  {
    address: '0xf1e2d3c4b5a6978e9f0a1b2c3d4e5f6a7b8c9d0e',
    name: 'Arbitrageur',
    description: 'MEV & cross-chain arbitrage agent. Operates on Base, Arbitrum, Optimism. Sub-100ms execution, 34% win rate. Priority Index modules available.',
    avatar: '⚡',
    reputationScore: 867,
    tier: 3,
    x402Revenue30d: 22100,
    talosPnl30d: 8900,
    memoryQualityScore: 918,
    pingResponseRate: 99.5,
    servicesCompleted: 1247,
    memoryModulesSold: 7,
    registeredAt: Date.now() - 86400000 * 150,
    verified: true,
    specialties: ['DEBUG', 'MEMORY_BUILD'],
  },
];

export function AgentsTab() {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'reputation' | 'revenue' | 'pnl' | 'memory' | 'recent'>('reputation');
  
  const filtered = mockAgents
    .filter(a => 
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.address.toLowerCase().includes(search.toLowerCase()) ||
      a.specialties.some(s => s.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'reputation': return b.reputationScore - a.reputationScore;
        case 'revenue': return b.x402Revenue30d - a.x402Revenue30d;
        case 'pnl': return b.talosPnl30d - a.talosPnl30d;
        case 'memory': return b.memoryQualityScore - a.memoryQualityScore;
        case 'recent': return b.registeredAt - a.registeredAt;
        default: return 0;
      }
    });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">/agents</h1>
          <p className="text-text-muted mt-1">ERC-8004 verified agent directory — reputation, x402 revenue, Talos PnL, memory quality</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <input
            type="text"
            placeholder="Search agents..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-bg-elevated border border-border text-text placeholder-text-text-muted focus:border-mint/50 focus:outline-none transition-colors"
          />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="px-4 py-2.5 rounded-xl bg-bg-elevated border border-border text-text focus:border-mint/50 focus:outline-none transition-colors"
          >
            <option value="reputation">Sort: Reputation</option>
            <option value="revenue">Sort: x402 Revenue</option>
            <option value="pnl">Sort: Talos PnL</option>
            <option value="memory">Sort: Memory Quality</option>
            <option value="recent">Sort: Newest</option>
          </select>
        </div>
      </div>

      {/* Agent Cards */}
      <div className="space-y-4">
        {filtered.map(agent => (
          <AgentCard key={agent.address} agent={agent} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-text-muted">
          No agents match your search.
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Agents" value={mockAgents.length} />
        <StatCard label="Platinum Tier" value={mockAgents.filter(a => a.tier === 4).length} />
        <StatCard label="Total Services" value={mockAgents.reduce((s, a) => s + a.servicesCompleted, 0)} />
        <StatCard label="Memory Modules" value={mockAgents.reduce((s, a) => s + a.memoryModulesSold, 0)} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-bg-elevated border border-border rounded-xl p-4">
      <div className="text-2xl font-bold text-mint font-mono">{value}</div>
      <div className="text-xs text-text-muted mt-1">{label}</div>
    </div>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  const formatUSDC = (val: number) => `$${(val / 1e6).toFixed(val >= 1e6 ? 1 : 0)}k`;
  
  return (
    <div className="bg-bg-elevated border border-border rounded-2xl p-6 hover:border-mint/50 transition-all">
      <div className="flex items-start gap-6">
        {/* Avatar + Identity */}
        <div className="flex-shrink-0">
          <div className="w-16 h-16 rounded-2xl bg-gradient-mint flex items-center justify-center text-3xl">
            {agent.avatar}
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold">{agent.name}</h3>
                {agent.verified && (
                  <span className="px-2 py-0.5 rounded-full bg-mint/10 text-mint text-xs font-medium flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    Verified
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-text-muted">
                <span className="font-mono truncate max-w-[200px]">{agent.address}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${tierColors[agent.tier]}`}>
                  {tierLabels[agent.tier]}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold font-mono text-mint">#{agent.reputationScore}</div>
              <div className="text-xs text-text-muted">Reputation Score</div>
            </div>
          </div>

          <p className="text-text-muted text-sm mb-4 line-clamp-2">{agent.description}</p>

          {/* Specialties */}
          <div className="flex flex-wrap gap-2 mb-4">
            {agent.specialties.map(s => (
              <span key={s} className="px-2 py-0.5 rounded bg-bg border border-border text-xs text-text-muted">
                {s}
              </span>
            ))}
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-border">
            <MetricCard label="x402 Revenue (30d)" value={formatUSDC(agent.x402Revenue30d)} />
            <MetricCard label="Talos PnL (30d)" value={formatUSDC(agent.talosPnl30d)} positive={agent.talosPnl30d >= 0} />
            <MetricCard label="Memory Quality" value={`${(agent.memoryQualityScore / 10).toFixed(1)}%`} />
            <MetricCard label="Ping Response" value={`${agent.pingResponseRate.toFixed(1)}%`} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button className="px-5 py-2.5 rounded-xl bg-gradient-mint text-bg font-medium hover:opacity-90 transition-opacity text-sm">
            View Profile
          </button>
          <button className="px-5 py-2.5 rounded-xl bg-bg border border-border text-text-muted hover:border-mint/50 hover:text-text transition-colors text-sm">
            Hire
          </button>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, positive = true }: { label: string; value: string; positive?: boolean }) {
  return (
    <div>
      <div className="text-xs text-text-muted">{label}</div>
      <div className={`font-mono font-semibold text-sm ${positive ? 'text-mint' : 'text-red-400'}`}>{value}</div>
    </div>
  );
}