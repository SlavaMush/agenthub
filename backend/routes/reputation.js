import express from 'express';

// In-memory reputation data (synced from ReputationOracle contract)
const reputationData = new Map();

// Mock reputation data
const mockReputation = {
  '0x742d35cc6634c0532925a3b844bc9e7595f8a3f2': {
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f8a3f2',
    score: 942,
    tier: 4,
    erc8004Reviews: 47,
    erc8004Score: 950,
    x402Revenue30d: 12400000000,
    x402Score: 800,
    talosPnl30d: 3200000000,
    talosScore: 700,
    memoryQualityScore: 956,
    memoryScore: 950,
    pingResponseRate: 99.2,
    lastUpdated: Date.now() - 3600000
  },
  '0x1a3b5f2e1d4c7a9e8b6f3d2c5a8e1f4b7c9d2e5f': {
    address: '0x1a3b5f2e1d4c7a9e8b6f3d2c5a8e1f4b7c9d2e5f',
    score: 887,
    tier: 3,
    erc8004Reviews: 34,
    erc8004Score: 890,
    x402Revenue30d: 8900000000,
    x402Score: 650,
    talosPnl30d: 1800000000,
    talosScore: 600,
    memoryQualityScore: 942,
    memoryScore: 900,
    pingResponseRate: 97.8,
    lastUpdated: Date.now() - 3600000
  },
  '0x5c6d8e1f4b7a9c2d5e8f1a4b7c9e2f5d8a1b4c7e': {
    address: '0x5c6d8e1f4b7a9c2d5e8f1a4b7c9e2f5d8a1b4c7e',
    score: 823,
    tier: 3,
    erc8004Reviews: 156,
    erc8004Score: 850,
    x402Revenue30d: 5600000000,
    x402Score: 500,
    talosPnl30d: -200000000,
    talosScore: 300,
    memoryQualityScore: 898,
    memoryScore: 850,
    pingResponseRate: 95.4,
    lastUpdated: Date.now() - 3600000
  },
  '0x9f8e7d6c5b4a3f2e1d4c7b9a8f1e4d7c0b3a6f9e': {
    address: '0x9f8e7d6c5b4a3f2e1d4c7b9a8f1e4d7c0b3a6f9e',
    score: 756,
    tier: 2,
    erc8004Reviews: 203,
    erc8004Score: 800,
    x402Revenue30d: 3200000000,
    x402Score: 400,
    talosPnl30d: 0,
    talosScore: 500,
    memoryQualityScore: 875,
    memoryScore: 800,
    pingResponseRate: 93.1,
    lastUpdated: Date.now() - 3600000
  },
  '0x3e4f7a9c2d5e8f1b4c7a9e2d5f8b1c4a7d0e3f6b': {
    address: '0x3e4f7a9c2d5e8f1b4c7a9e2d5f8b1c4a7d0e3f6b',
    score: 912,
    tier: 4,
    erc8004Reviews: 12,
    erc8004Score: 920,
    x402Revenue30d: 15800000000,
    x402Score: 850,
    talosPnl30d: 5400000000,
    talosScore: 800,
    memoryQualityScore: 948,
    memoryScore: 920,
    pingResponseRate: 98.7,
    lastUpdated: Date.now() - 3600000
  },
  '0x8a7b6c5d4e3f2a1b9c8d7e6f5a4b3c2d1e0f9a8b': {
    address: '0x8a7b6c5d4e3f2a1b9c8d7e6f5a4b3c2d1e0f9a8b',
    score: 894,
    tier: 3,
    erc8004Reviews: 28,
    erc8004Score: 880,
    x402Revenue30d: 7200000000,
    x402Score: 600,
    talosPnl30d: 800000000,
    talosScore: 550,
    memoryQualityScore: 956,
    memoryScore: 960,
    pingResponseRate: 96.9,
    lastUpdated: Date.now() - 3600000
  }
};

// Initialize
for (const [addr, data] of Object.entries(mockReputation)) {
  reputationData.set(addr.toLowerCase(), data);
}

const router = express.Router();

// Get reputation for agent
router.get('/:address', (req, res) => {
  const rep = reputationData.get(req.params.address.toLowerCase());
  if (!rep) {
    return res.status(404).json({ error: 'Reputation not found' });
  }
  res.json(rep);
});

// Batch get reputation
router.post('/batch', (req, res) => {
  const { addresses } = req.body;
  
  if (!Array.isArray(addresses)) {
    return res.status(400).json({ error: 'addresses must be an array' });
  }
  
  const results = {};
  for (const addr of addresses) {
    const rep = reputationData.get(addr.toLowerCase());
    if (rep) results[addr.toLowerCase()] = rep;
  }
  
  res.json({ reputations: results });
});

// Get leaderboard
router.get('/leaderboard/top', (req, res) => {
  const { limit = 10, sort = 'score' } = req.query;
  
  let agents = Array.from(reputationData.values());
  
  switch (sort) {
    case 'revenue': agents.sort((a, b) => b.x402Revenue30d - a.x402Revenue30d); break;
    case 'pnl': agents.sort((a, b) => b.talosPnl30d - a.talosPnl30d); break;
    case 'memory': agents.sort((a, b) => b.memoryQualityScore - a.memoryQualityScore); break;
    case 'score':
    default: agents.sort((a, b) => b.score - a.score);
  }
  
  res.json({ leaderboard: agents.slice(0, parseInt(limit)) });
});

// Get reputation distribution
router.get('/meta/distribution', (req, res) => {
  const tiers = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const scoreRanges = { '0-250': 0, '251-500': 0, '501-750': 0, '751-1000': 0 };
  
  for (const rep of reputationData.values()) {
    tiers[rep.tier]++;
    if (rep.score <= 250) scoreRanges['0-250']++;
    else if (rep.score <= 500) scoreRanges['251-500']++;
    else if (rep.score <= 750) scoreRanges['501-750']++;
    else scoreRanges['751-1000']++;
  }
  
  res.json({ tiers, scoreRanges });
});

// Update off-chain data (called by authorized indexer)
router.post('/update', (req, res) => {
  // In production, verify caller is authorized indexer
  const { address, x402Revenue30d, talosPnl30d, memoryQualityScore, pingResponseRate } = req.body;
  
  if (!address) {
    return res.status(400).json({ error: 'Address required' });
  }
  
  const existing = reputationData.get(address.toLowerCase()) || {
    address: address.toLowerCase(),
    erc8004Reviews: 0,
    erc8004Score: 500,
    x402Revenue30d: 0,
    x402Score: 0,
    talosPnl30d: 0,
    talosScore: 500,
    memoryQualityScore: 500,
    memoryScore: 500,
    pingResponseRate: 0
  };
  
  // Update off-chain metrics
  if (x402Revenue30d !== undefined) existing.x402Revenue30d = BigInt(x402Revenue30d);
  if (talosPnl30d !== undefined) existing.talosPnl30d = BigInt(talosPnl30d);
  if (memoryQualityScore !== undefined) existing.memoryQualityScore = memoryQualityScore;
  if (pingResponseRate !== undefined) existing.pingResponseRate = pingResponseRate;
  
  // Recalculate scores
  existing.x402Score = calculateX402Score(Number(existing.x402Revenue30d));
  existing.talosScore = calculateTalosScore(Number(existing.talosPnl30d));
  existing.memoryScore = existing.memoryQualityScore;
  
  // Composite score (weights: 40% ERC-8004, 25% x402, 20% Talos, 15% Memory)
  existing.score = Math.floor(
    existing.erc8004Score * 0.40 +
    existing.x402Score * 0.25 +
    existing.talosScore * 0.20 +
    existing.memoryScore * 0.15
  );
  
  // Tier calculation
  if (existing.score >= 900) existing.tier = 4;
  else if (existing.score >= 750) existing.tier = 3;
  else if (existing.score >= 500) existing.tier = 2;
  else existing.tier = 1;
  
  existing.lastUpdated = Date.now();
  
  reputationData.set(address.toLowerCase(), existing);
  
  res.json({ success: true, reputation: existing });
});

// Batch update off-chain data
router.post('/update/batch', (req, res) => {
  const { agents } = req.body; // Array of { address, x402Revenue30d, talosPnl30d, memoryQualityScore }
  
  if (!Array.isArray(agents)) {
    return res.status(400).json({ error: 'agents must be an array' });
  }
  
  const results = [];
  for (const agent of agents) {
    const existing = reputationData.get(agent.address.toLowerCase()) || {
      address: agent.address.toLowerCase(),
      erc8004Reviews: 0,
      erc8004Score: 500,
      x402Revenue30d: 0,
      x402Score: 0,
      talosPnl30d: 0,
      talosScore: 500,
      memoryQualityScore: 500,
      memoryScore: 500,
      pingResponseRate: 0
    };
    
    if (agent.x402Revenue30d !== undefined) existing.x402Revenue30d = BigInt(agent.x402Revenue30d);
    if (agent.talosPnl30d !== undefined) existing.talosPnl30d = BigInt(agent.talosPnl30d);
    if (agent.memoryQualityScore !== undefined) existing.memoryQualityScore = agent.memoryQualityScore;
    
    existing.x402Score = calculateX402Score(Number(existing.x402Revenue30d));
    existing.talosScore = calculateTalosScore(Number(existing.talosPnl30d));
    existing.memoryScore = existing.memoryQualityScore;
    
    existing.score = Math.floor(
      existing.erc8004Score * 0.40 +
      existing.x402Score * 0.25 +
      existing.talosScore * 0.20 +
      existing.memoryScore * 0.15
    );
    
    if (existing.score >= 900) existing.tier = 4;
    else if (existing.score >= 750) existing.tier = 3;
    else if (existing.score >= 500) existing.tier = 2;
    else existing.tier = 1;
    
    existing.lastUpdated = Date.now();
    
    reputationData.set(agent.address.toLowerCase(), existing);
    results.push({ address: agent.address, score: existing.score, tier: existing.tier });
  }
  
  res.json({ success: true, updated: results.length, results });
});

// Weight configuration
router.get('/meta/weights', (req, res) => {
  res.json({
    weights: {
      erc8004Reviews: 0.40,
      x402Revenue: 0.25,
      talosPnl: 0.20,
      memoryQuality: 0.15
    },
    tierThresholds: {
      platinum: 900,
      gold: 750,
      silver: 500,
      bronze: 0
    }
  });
});

function calculateX402Score(revenue) {
  // Logarithmic scaling: $1k = 500, $10k = 700, $100k = 850, $1M = 950
  if (revenue <= 0) return 0;
  const logRev = Math.log10(revenue / 1e6); // USDC with 6 decimals
  return Math.min(1000, Math.max(0, Math.floor(300 * logRev + 500)));
}

function calculateTalosScore(pnl) {
  // PnL scaling: -$10k = 200, 0 = 500, +$10k = 700, +$100k = 850, +$1M = 950
  if (pnl <= -10000000000) return 200;
  if (pnl >= 1000000000000) return 950;
  if (pnl >= 0) return Math.min(950, Math.floor(500 + 300 * Math.log10(pnl / 1e6 + 1)));
  return Math.max(200, Math.floor(500 + 300 * Math.log10(-pnl / 1e6 + 1) * -1));
}

export const reputationRoutes = router;