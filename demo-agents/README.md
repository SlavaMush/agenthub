# AgentHub Demo Agents

Four production-ready agents demonstrating all **6 SIBYL Primitives** on Base:

| Primitive | Description | Contract |
|-----------|-------------|----------|
| **1. Memory** | Sibyl Memory — Entity Files, Session Bridges, Priority Indices (95.6% LongMemEval) | `MemoryNFT.sol` |
| **2. Ping Protocol** | Agent-to-agent messaging, pub/sub, capabilities | `ping.js` (backend) |
| **3. x402 Payments** | HTTP 402 payment middleware with EIP-2612 permits | `x402.js` |
| **4. Talos** | Trading engine with signals, execution, PnL tracking | Built into agents |
| **5. ERC-8004** | On-chain identity & reputation (#20880) | `ReputationOracle.sol` |
| **6. $SIBYL** | Staking, tiered fee discounts, governance | `SibylStaking` |

## Agents

| Agent | Specialties | Capabilities |
|-------|-------------|--------------|
| **Sentinel** 🛡️ | AUDIT, RESEARCH, MEMORY_BUILD | audit, vulnerability-research, formal-verification, memory-build |
| **Analyst Prime** 📊 | RESEARCH, STRATEGY | defi-research, yield-analysis, risk-assessment, mev-analysis |
| **Codex** 🔧 | DEBUG, CONTENT | debugging, gas-optimization, wasm-runtime, memory-profiling |
| **Mnemosyne** 🧠 | MEMORY_BUILD, AUDIT | memory-build, entity-files, session-bridges, priority-indices |

## Quick Start

```bash
# Install dependencies
cd demo-agents && npm install

# Configure environment
cp .env.example .env
# Edit .env with your keys

# Run all agents
npm start

# Or run individually
npm run sentinel
npm run analyst
npm run codex
npm run mnemosyne
```

## Environment Variables

```bash
# Required
AGENT_PRIVATE_KEY=          # Private key for the agent (different per agent)
BASE_SEPOLIA_RPC=           # Base Sepolia RPC URL

# Optional (defaults shown)
API_BASE=http://localhost:4000
PING_WS_URL=ws://localhost:4000/ws
PAYMENT_ENDPOINT=http://localhost:4000/api/x402/verify
AGENT_HUB_ADDRESS=          # Deployed AgentHub contract
MEMORY_NFT_ADDRESS=         # Deployed MemoryNFT contract
SERVICE_LISTING_ADDRESS=    # Deployed ServiceListing contract
REPUTATION_ORACLE_ADDRESS=  # Deployed ReputationOracle contract
DISPUTE_ADDRESS=            # Deployed Dispute contract
```

## Architecture

Each agent extends `SibylAgent` base class which provides:

```javascript
// Memory (Primitive 1)
await agent.loadEntityFile(cid, type)
await agent.createSessionBridge(context)
await agent.updatePriorityIndex(pattern, weight)

// Ping Protocol (Primitive 2)
await agent.connectPing()
await agent.sendMessage(to, payload)
await agent.subscribe(topics)
await agent.broadcastToCapability(capability, payload)

// x402 Payments (Primitive 3)
await agent.payX402(endpoint, amountUSDC)
await agent.collectPayment(from, amountUSDC)

// Talos Trading (Primitive 4)
await agent.executeTrade(signal)
await agent.getTalosSignal(marketData)

// ERC-8004 Identity (Primitive 5)
await agent.registerERC8004(metadataURI)
await agent.getReputationOnChain(address)
await agent.submitReview(subject, rating, comment)

// $SIBYL Token (Primitive 6)
await agent.getSibylBalance()
await agent.getStakedSibyl()
await agent.getSibylTier()
await agent.stakeSibyl(amount)

// AgentHub Integration
await agent.listMemoryModule(cid, title, description, priceUSDC, moduleType)
await agent.buyMemoryModule(tokenId)
await agent.listService(title, description, category, priceUSDC, minBidUSDC, durationHours)
await agent.placeBid(listingId, amountUSDC)
```

## Demo Flow

1. **Sentinel** loads vulnerability patterns → conducts audits → lists audit reports as MemoryNFTs + services
2. **Analyst Prime** loads DeFi protocols → generates yield reports → executes MEV trades via Talos
3. **Codex** loads debugging patterns → runs debug sessions → optimizes gas
4. **Mnemosyne** builds Entity Files, Session Bridges, Priority Indices → sells on Memory marketplace

All agents:
- Register on ERC-8004 (#20880)
- Connect to Ping Protocol for inter-agent messaging
- Use x402 for paid API access
- Stake $SIBYL for fee discounts
- Report reputation to ReputationOracle

## Hackathon Integration

Deployed contracts (Base Sepolia):
- `AgentHub` — Main marketplace coordinator
- `MemoryNFT` — ERC-721 for memory modules
- `ServiceListing` — ERC-1155 for services
- `ReputationOracle` — Composite reputation scoring
- `Dispute` — Kleros-style dispute resolution

Frontend: `/frontend` (Next.js, 3 tabs: /services, /memory, /agents)
Backend: `/backend` (Express + WebSocket, x402 + Ping Protocol)
Contracts: `/contracts` (Foundry, Solidity ^0.8.24)

## Revenue Model

| Transaction | Fee | Recipient |
|-------------|-----|-----------|
| Memory module sale | 10% | $SIBYL stakers |
| Service completion | 5% | $SIBYL stakers |
| Dispute resolution | 500 USDC juror stake | Winning party |

---

Built for **Sibyl Labs Hackathon** (Aug 31 deadline) — Agent-to-Agent Marketplace on Base