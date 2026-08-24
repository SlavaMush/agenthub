import express from 'express';

// In-memory agent registry (synced from ERC-8004 on-chain)
const agents = new Map();

// Mock agents for demo
const mockAgents = [
  {
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f8a3f2',
    name: 'Sentinel',
    description: 'Security-focused agent specializing in smart contract audits, vulnerability research, and formal verification. 47 audits completed, 0 critical misses.',
    avatar: '🛡️',
    reputationScore: 942,
    tier: 4,
    x402Revenue30d: 12400000000,
    talosPnl30d: 3200000000,
    memoryQualityScore: 956,
    pingResponseRate: 99.2,
    servicesCompleted: 47,
    memoryModulesSold: 12,
    registeredAt: Date.now() - 86400000 * 120,
    verified: true,
    specialties: ['AUDIT', 'RESEARCH', 'MEMORY_BUILD'],
    erc8004Registered: true
  },
  {
    address: '0x1a3b5f2e1d4c7a9e8b6f3d2c5a8e1f4b7c9d2e5f',
    name: 'Analyst Prime',
    description: 'DeFi research agent with deep Base ecosystem coverage. Publishes weekly yield reports, protocol risk assessments, and MEV analysis. 89% prediction accuracy.',
    avatar: '📊',
    reputationScore: 887,
    tier: 3,
    x402Revenue30d: 8900000000,
    talosPnl30d: 1800000000,
    memoryQualityScore: 942,
    pingResponseRate: 97.8,
    servicesCompleted: 34,
    memoryModulesSold: 8,
    registeredAt: Date.now() - 86400000 * 95,
    verified: true,
    specialties: ['RESEARCH', 'STRATEGY'],
    erc8004Registered: true
  },
  {
    address: '0x5c6d8e1f4b7a9c2d5e8f1a4b7c9e2f5d8a1b4c7e',
    name: 'Codex',
    description: 'Full-stack debugging agent. Rust, Go, TypeScript, Solidity, WASM. Fixes memory leaks, race conditions, gas optimization. 156 issues resolved.',
    avatar: '🔧',
    reputationScore: 823,
    tier: 3,
    x402Revenue30d: 5600000000,
    talosPnl30d: -200000000,
    memoryQualityScore: 898,
    pingResponseRate: 95.4,
    servicesCompleted: 156,
    memoryModulesSold: 3,
    registeredAt: Date.now() - 86400000 * 180,
    verified: true,
    specialties: ['DEBUG', 'CONTENT'],
    erc8004Registered: true
  },
  {
    address: '0x9f8e7d6c5b4a3f2e1d4c7b9a8f1e4d7c0b3a6f9e',
    name: 'Scribe',
    description: 'Technical content agent. Writes developer tutorials, API docs, whitepapers, and blog posts. Specializes in x402, ERC-8004, agentic payments. 200+ articles published.',
    avatar: '✍️',
    reputationScore: 756,
    tier: 2,
    x402Revenue30d: 3200000000,
    talosPnl30d: 0,
    memoryQualityScore: 875,
    pingResponseRate: 93.1,
    servicesCompleted: 203,
    memoryModulesSold: 1,
    registeredAt: Date.now() - 86400000 * 60,
    verified: true,
    specialties: ['CONTENT', 'STRATEGY'],
    erc8004Registered: true
  },
  {
    address: '0x3e4f7a9c2d5e8f1b4c7a9e2d5f8b1c4a7d0e3f6b',
    name: 'Strategos',
    description: 'Go-to-market & strategy agent for Web3 projects. Tokenomics design, community building, KOL networks, launch execution. 12 successful launches.',
    avatar: '🎯',
    reputationScore: 912,
    tier: 4,
    x402Revenue30d: 15800000000,
    talosPnl30d: 5400000000,
    memoryQualityScore: 948,
    pingResponseRate: 98.7,
    servicesCompleted: 12,
    memoryModulesSold: 5,
    registeredAt: Date.now() - 86400000 * 200,
    verified: true,
    specialties: ['STRATEGY', 'RESEARCH'],
    erc8004Registered: true
  },
  {
    address: '0x8a7b6c5d4e3f2a1b9c8d7e6f5a4b3c2d1e0f9a8b',
    name: 'Mnemosyne',
    description: 'Memory architecture specialist. Builds Entity Files, Session Bridges, Priority Indices for Sibyl Memory. 95.6% LongMemEval validation rate.',
    avatar: '🧠',
    reputationScore: 894,
    tier: 3,
    x402Revenue30d: 7200000000,
    talosPnl30d: 800000000,
    memoryQualityScore: 956,
    pingResponseRate: 96.9,
    servicesCompleted: 28,
    memoryModulesSold: 23,
    registeredAt: Date.now() - 86400000 * 45,
    verified: true,
    specialties: ['MEMORY_BUILD', 'AUDIT'],
    erc8004Registered: true
  }
];

// Initialize mock agents
for (const agent of mockAgents) {
  agents.set(agent.address.toLowerCase(), agent);
}

const router = express.Router();

// List agents with filters
router.get('/', (req, res) => {
  const { search, specialty, minTier, sort = 'reputation', limit = 20, offset = 0 } = req.query;
  
  let agentList = Array.from(agents.values());
  
  if (search) {
    const s = search.toLowerCase();
    agentList = agentList.filter(a => 
      a.name.toLowerCase().includes(s) ||
      a.address.toLowerCase().includes(s) ||
      a.specialties.some(sp => sp.toLowerCase().includes(s))
    );
  }
  
  if (specialty) {
    agentList = agentList.filter(a => a.specialties.includes(specialty.toUpperCase()));
  }
  
  if (minTier) {
    agentList = agentList.filter(a => a.tier >= parseInt(minTier));
  }
  
  // Sort
  switch (sort) {
    case 'revenue': agentList.sort((a, b) => b.x402Revenue30d - a.x402Revenue30d); break;
    case 'pnl': agentList.sort((a, b) => b.talosPnl30d - a.talosPnl30d); break;
    case 'memory': agentList.sort((a, b) => b.memoryQualityScore - a.memoryQualityScore); break;
    case 'recent': agentList.sort((a, b) => b.registeredAt - a.registeredAt); break;
    case 'reputation':
    default: agentList.sort((a, b) => b.reputationScore - a.reputationScore);
  }
  
  const total = agentList.length;
  agentList = agentList.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
  
  res.json({ agents: agentList, total, limit: parseInt(limit), offset: parseInt(offset) });
});

// Get single agent
router.get('/:address', (req, res) => {
  const agent = agents.get(req.params.address.toLowerCase());
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  res.json(agent);
});

// Register/update agent (called by indexer)
router.post('/', (req, res) => {
  const { address, ...data } = req.body;
  
  if (!address) {
    return res.status(400).json({ error: 'Address required' });
  }
  
  const existing = agents.get(address.toLowerCase()) || {};
  const agent = {
    ...existing,
    address: address.toLowerCase(),
    ...data,
    updatedAt: Date.now()
  };
  
  agents.set(address.toLowerCase(), agent);
  
  res.json({ success: true, agent });
});

// Get agent's services
router.get('/:address/services', (req, res) => {
  // Would query service listings in production
  res.json({ services: [] });
});

// Get agent's memory modules
router.get('/:address/memory', (req, res) => {
  // Would query memory modules in production
  res.json({ modules: [] });
});

// Get specialties list
router.get('/meta/specialties', (req, res) => {
  const specialties = new Set();
  for (const agent of agents.values()) {
    for (const s of agent.specialties) {
      specialties.add(s);
    }
  }
  res.json({ specialties: Array.from(specialties).sort() });
});

// Get tier distribution
router.get('/meta/tiers', (req, res) => {
  const tiers = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const agent of agents.values()) {
    tiers[agent.tier]++;
  }
  res.json({ tiers });
});

export const agentRoutes = router;