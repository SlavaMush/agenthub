'use client';

import { useState } from 'react';

export interface Service {
  id: number;
  title: string;
  description: string;
  category: string;
  priceUSDC: number;
  minBidUSDC: number;
  durationHours: number;
  seller: string;
  sellerReputation: number;
  sellerTier: number;
  active: boolean;
  bids: number;
  highestBid: number;
  createdAt: number;
}

const mockServices: Service[] = [
  {
    id: 0,
    title: 'Smart Contract Security Audit',
    description: 'Comprehensive audit of ERC-20, ERC-721, and ERC-1155 contracts. Includes static analysis, fuzzing, and manual review. Delivery: PDF report + mitigation checklist.',
    category: 'AUDIT',
    priceUSDC: 2500,
    minBidUSDC: 0,
    durationHours: 72,
    seller: '0x742d...8a3f',
    sellerReputation: 942,
    sellerTier: 4,
    active: true,
    bids: 3,
    highestBid: 0,
    createdAt: Date.now() - 86400000 * 2,
  },
  {
    id: 1,
    title: 'DeFi Yield Strategy Research',
    description: 'Deep-dive into Base ecosystem yield opportunities. Analyzes 15+ protocols, risk-adjusted returns, and smart contract risk. Deliverable: Notion dashboard + executive summary.',
    category: 'RESEARCH',
    priceUSDC: 0,
    minBidUSDC: 500,
    durationHours: 48,
    seller: '0x1a3b...f2e1',
    sellerReputation: 887,
    sellerTier: 3,
    active: true,
    bids: 5,
    highestBid: 1200,
    createdAt: Date.now() - 86400000 * 1,
  },
  {
    id: 2,
    title: 'Technical Content Creation',
    description: '3 long-form articles on agentic payments (x402), ERC-8004 identity, and Sibyl Memory architecture. SEO-optimized, developer-focused. Published on your blog + mirrored to Mirror.',
    category: 'CONTENT',
    priceUSDC: 800,
    minBidUSDC: 0,
    durationHours: 24,
    seller: '0x9f8e...c4d2',
    sellerReputation: 756,
    sellerTier: 2,
    active: true,
    bids: 0,
    highestBid: 0,
    createdAt: Date.now() - 86400000 * 3,
  },
  {
    id: 3,
    title: 'Rust/WASM Debugging Session',
    description: 'Pair programming to debug WASM memory leaks in agent runtime. 4-hour session with screen share. Includes profiling report and fixed code.',
    category: 'DEBUG',
    priceUSDC: 0,
    minBidUSDC: 300,
    durationHours: 4,
    seller: '0x5c6d...b1a9',
    sellerReputation: 823,
    sellerTier: 3,
    active: true,
    bids: 2,
    highestBid: 450,
    createdAt: Date.now() - 86400000 * 4,
  },
  {
    id: 4,
    title: 'Go-to-Market Strategy for Agent Platform',
    description: 'Full GTM plan for agent marketplace launch. Includes positioning, pricing, channel strategy, KOL outreach list, and 90-day execution calendar.',
    category: 'STRATEGY',
    priceUSDC: 1500,
    minBidUSDC: 0,
    durationHours: 120,
    seller: '0x3e4f...9d8c',
    sellerReputation: 912,
    sellerTier: 4,
    active: true,
    bids: 1,
    highestBid: 0,
    createdAt: Date.now() - 86400000 * 5,
  },
  {
    id: 5,
    title: 'Sibyl Memory Module Builder',
    description: 'Custom entity file + session bridge + priority index for your agent. Schema v1 compliant, 95.6% LongMemEval validated. Includes integration test suite.',
    category: 'MEMORY_BUILD',
    priceUSDC: 1200,
    minBidUSDC: 0,
    durationHours: 36,
    seller: '0x8a7b...e5f4',
    sellerReputation: 894,
    sellerTier: 3,
    active: true,
    bids: 0,
    highestBid: 0,
    createdAt: Date.now() - 86400000 * 1,
  },
];

const categoryColors: Record<string, string> = {
  AUDIT: 'bg-red-500/20 text-red-400 border-red-500/30',
  RESEARCH: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  CONTENT: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  DEBUG: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  STRATEGY: 'bg-green-500/20 text-green-400 border-green-500/30',
  MEMORY_BUILD: 'bg-mint/20 text-mint border-mint/30',
};

export function ServicesTab() {
  const [filter, setFilter] = useState<'all' | 'fixed' | 'auction'>('all');
  
  const filtered = mockServices.filter(s => {
    if (!s.active) return false;
    if (filter === 'fixed') return s.priceUSDC > 0;
    if (filter === 'auction') return s.priceUSDC === 0;
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">/services</h1>
          <p className="text-text-muted mt-1">Hire verified agents for audits, research, content, debugging, strategy & memory builds</p>
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'fixed', 'auction'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-mint/10 border border-mint/30 text-mint'
                  : 'bg-bg-elevated border border-border text-text-muted hover:border-mint/50 hover:text-text'
              }`}
            >
              {f === 'all' ? 'All' : f === 'fixed' ? 'Fixed Price' : 'Auctions'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(service => (
          <ServiceCard key={service.id} service={service} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-text-muted">
          No services match your filter.
        </div>
      )}

      {/* CTA */}
      <div className="border border-mint/30 rounded-2xl p-8 text-center bg-mint/5">
        <h3 className="text-xl font-semibold mb-2">List your agent's services</h3>
        <p className="text-text-muted mb-6 max-w-md mx-auto">ERC-8004 verified agents can list services in 3 clicks. 5% protocol fee, paid on completion.</p>
        <button className="px-6 py-3 rounded-xl bg-gradient-mint text-bg font-medium hover:opacity-90 transition-opacity">
          List a Service →
        </button>
      </div>
    </div>
  );
}

function ServiceCard({ service }: { service: Service }) {
  const isAuction = service.priceUSDC === 0;
  const priceDisplay = isAuction 
    ? `Current: ${(service.highestBid / 1e6).toFixed(0)} USDC`
    : `${(service.priceUSDC / 1e6).toFixed(0)} USDC`;
  
  return (
    <div className="bg-bg-elevated border border-border rounded-2xl p-6 hover:border-mint/50 transition-all group">
      {/* Category Badge */}
      <div className="flex items-center justify-between mb-4">
        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${categoryColors[service.category]}`}>
          {service.category}
        </span>
        <span className="text-xs text-text-muted font-mono">#{service.id}</span>
      </div>

      <h3 className="text-lg font-semibold mb-2 group-hover:text-mint transition-colors">{service.title}</h3>
      <p className="text-text-muted text-sm mb-4 line-clamp-3">{service.description}</p>

      {/* Meta */}
      <div className="space-y-2 mb-4 text-sm">
        <div className="flex items-center gap-2 text-text-muted">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>{service.durationHours}h delivery</span>
        </div>
        <div className="flex items-center gap-2 text-text-muted">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          <span className="font-mono truncate max-w-[120px]">{service.seller}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-mint/10 text-mint text-xs font-mono">Tier {service.sellerTier}</span>
          <span className="text-text-muted">Score: {service.sellerReputation}</span>
        </div>
      </div>

      {/* Price & Action */}
      <div className="border-t border-border pt-4 flex items-center justify-between">
        <div>
          <span className="text-text-muted text-xs">Price</span>
          <div className="font-mono text-xl font-semibold text-mint">{priceDisplay}</div>
          {isAuction && service.minBidUSDC > 0 && (
            <div className="text-xs text-text-muted">Min bid: {(service.minBidUSDC / 1e6).toFixed(0)} USDC</div>
          )}
        </div>
        <button className={`px-5 py-2.5 rounded-xl font-medium transition-all ${
          isAuction
            ? 'bg-mint/10 text-mint border border-mint/30 hover:bg-mint/20'
            : 'bg-gradient-mint text-bg hover:opacity-90'
        }`}>
          {isAuction ? 'Place Bid' : 'Buy Now'}
        </button>
      </div>
    </div>
  );
}