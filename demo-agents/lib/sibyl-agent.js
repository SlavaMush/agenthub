// Base Agent Class — Uses all 6 SIBYL Primitives
// 1. Memory (LongMemEval 95.6%)
// 2. Ping Protocol
// 3. x402 Payments
// 4. Talos Trading Engine
// 5. ERC-8004 Identity (#20880)
// 6. $SIBYL Token

import { WebSocket } from 'ws';
import { createPublicClient, http, createWalletClient, parseEther, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import dotenv from 'dotenv';

dotenv.config();

// SIBYL Contract Addresses (Base Sepolia)
const CONTRACTS = {
  ERC8004_REGISTRY: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
  ERC8004_REPUTATION: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
  SIBYL_TOKEN: '0x797f214a2CD64a4963A91Fa21c8C55Ec3EBa4714',
  SIBYL_STAKING: '0x6151AA0689576E8F8D218f4DC7F6A4Ec1533d44d',
  USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  AGENT_HUB: process.env.AGENT_HUB_ADDRESS || '',
  MEMORY_NFT: process.env.MEMORY_NFT_ADDRESS || '',
  SERVICE_LISTING: process.env.SERVICE_LISTING_ADDRESS || '',
  REPUTATION_ORACLE: process.env.REPUTATION_ORACLE_ADDRESS || '',
  DISPUTE: process.env.DISPUTE_ADDRESS || '',
};

// ABIs
const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
];

const ERC8004_REGISTRY_ABI = [
  { name: 'isRegistered', type: 'function', stateMutability: 'view', inputs: [{ name: 'agent', type: 'address' }], outputs: [{ type: 'bool' }] },
  { name: 'register', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'metadataURI', type: 'string' }], outputs: [] },
  { name: 'getMetadata', type: 'function', stateMutability: 'view', inputs: [{ name: 'agent', type: 'address' }], outputs: [{ name: 'metadataURI', type: 'string' }, { name: 'registeredAt', type: 'uint256' }] },
];

const REPUTATION_ABI = [
  { name: 'getScore', type: 'function', stateMutability: 'view', inputs: [{ name: 'agent', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'getTier', type: 'function', stateMutability: 'view', inputs: [{ name: 'agent', type: 'address' }], outputs: [{ type: 'uint8' }] },
  { name: 'submitReview', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'subject', type: 'address' }, { name: 'rating', type: 'uint8' }, { name: 'comment', type: 'string' }], outputs: [] },
];

const SIBYL_STAKING_ABI = [
  { name: 'stake', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'unstake', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'getStakedAmount', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'getTier', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint8' }] },
];

const MEMORY_NFT_ABI = [
  { name: 'mintMemoryModule', type: 'function', stateMutability: 'nonpayable', inputs: [
    { name: 'cid', type: 'string' },
    { name: 'validationHash', type: 'bytes32' },
    { name: 'schemaVersion', type: 'uint8' },
    { name: 'moduleType', type: 'uint8' },
    { name: 'title', type: 'string' },
    { name: 'description', type: 'string' },
    { name: 'priceUSDC', type: 'uint256' }
  ], outputs: [{ type: 'uint256' }] },
  { name: 'buyMemoryModule', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [] },
];

const SERVICE_LISTING_ABI = [
  { name: 'listService', type: 'function', stateMutability: 'nonpayable', inputs: [
    { name: 'title', type: 'string' },
    { name: 'description', type: 'string' },
    { name: 'category', type: 'uint8' },
    { name: 'priceUSDC', type: 'uint256' },
    { name: 'minBidUSDC', type: 'uint256' },
    { name: 'durationHours', type: 'uint256' }
  ], outputs: [{ type: 'uint256' }] },
  { name: 'placeBid', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'listingId', type: 'uint256' }, { name: 'amountUSDC', type: 'uint256' }], outputs: [] },
  { name: 'buyNow', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'listingId', type: 'uint256' }], outputs: [] },
];

const REPUTATION_ORACLE_ABI = [
  { name: 'computeScore', type: 'function', stateMutability: 'view', inputs: [{ name: 'agent', type: 'address' }], outputs: [{ type: 'uint256' }, { type: 'uint8' }] },
  { name: 'x402Revenue30d', type: 'function', stateMutability: 'view', inputs: [{ name: 'agent', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'talosPnl30d', type: 'function', stateMutability: 'view', inputs: [{ name: 'agent', type: 'address' }], outputs: [{ type: 'int256' }] },
  { name: 'memoryQualityScore', type: 'function', stateMutability: 'view', inputs: [{ name: 'agent', type: 'address' }], outputs: [{ type: 'uint256' }] },
];

// RPC Client
const rpcClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org')
});

export class SibylAgent {
  constructor(config = {}) {
    this.name = config.name || 'Unnamed Agent';
    this.description = config.description || '';
    this.privateKey = config.privateKey || process.env.AGENT_PRIVATE_KEY;
    this.account = this.privateKey ? privateKeyToAccount(this.privateKey) : null;
    this.walletClient = this.account ? createWalletClient({ account: this.account, chain: baseSepolia, transport: http(process.env.BASE_SEPOLIA_RPC) }) : null;
    
    // Agent identity
    this.address = this.account?.address || config.address;
    this.capabilities = config.capabilities || [];
    this.specialties = config.specialties || [];
    
    // Sibyl Memory (Primitive 1)
    this.memory = {
      entityFiles: new Map(),
      sessionBridges: new Map(),
      priorityIndices: new Map(),
      validationScore: 956 // 95.6% LongMemEval
    };
    
    // Ping Protocol (Primitive 2)
    this.pingWs = null;
    this.pingConnected = false;
    this.pingLatency = 0;
    this.messageHandlers = new Map();
    this.subscriptions = new Set();
    
    // x402 Payments (Primitive 3)
    this.x402Enabled = true;
    this.paymentEndpoint = process.env.PAYMENT_ENDPOINT || 'http://localhost:4000/api/x402/verify';
    
    // Talos Trading (Primitive 4)
    this.talos = {
      positions: new Map(),
      pnl30d: 0,
      winRate: 0,
      avgLatency: 0
    };
    
    // ERC-8004 Identity (Primitive 5) - #20880
    this.erc8004Registered = false;
    this.reputationScore = 0;
    this.reputationTier = 1;
    
    // $SIBYL Token (Primitive 6)
    this.sibylBalance = 0;
    this.sibylStaked = 0;
    this.sibylTier = 0;
    
    // Backend API
    this.apiBase = process.env.API_BASE || 'http://localhost:4000';
  }
  
  // ==================== 1. MEMORY (Sibyl Memory - LongMemEval 95.6%) ====================
  
  async loadEntityFile(cid, type) {
    console.log(`[${this.name}] Loading Entity File: ${cid} (${type})`);
    // In production: fetch from IPFS, validate against schema v1
    const entityFile = {
      cid,
      type,
      loadedAt: Date.now(),
      validated: true,
      validationScore: this.memory.validationScore
    };
    this.memory.entityFiles.set(cid, entityFile);
    return entityFile;
  }
  
  async createSessionBridge(context) {
    console.log(`[${this.name}] Creating Session Bridge`);
    const bridge = {
      id: `bridge_${Date.now()}`,
      context,
      createdAt: Date.now(),
      chainId: 84532 // Base Sepolia
    };
    this.memory.sessionBridges.set(bridge.id, bridge);
    return bridge;
  }
  
  async updatePriorityIndex(pattern, weight) {
    console.log(`[${this.name}] Updating Priority Index: ${pattern}`);
    this.memory.priorityIndices.set(pattern, { weight, updatedAt: Date.now() });
  }
  
  async getMemoryContext(query) {
    // Search across all memory types
    const results = {
      entities: [],
      sessions: [],
      priorities: []
    };
    
    for (const [cid, file] of this.memory.entityFiles) {
      if (cid.includes(query) || file.type.includes(query)) {
        results.entities.push(file);
      }
    }
    
    return results;
  }
  
  // ==================== 2. PING PROTOCOL ====================
  
  async connectPing() {
    return new Promise((resolve, reject) => {
      const wsUrl = process.env.PING_WS_URL || 'ws://localhost:4000/ws';
      this.pingWs = new WebSocket(wsUrl, {
        headers: { 'x-agent-address': this.address }
      });
      
      this.pingWs.on('open', () => {
        console.log(`[${this.name}] Ping Protocol connected`);
        this.pingConnected = true;
        
        // Register with capabilities
        this.pingSend({
          type: 'register',
          agentAddress: this.address,
          capabilities: this.capabilities,
          reputationTier: this.reputationTier
        });
        
        resolve();
      });
      
      this.pingWs.on('message', (data) => {
        const message = JSON.parse(data.toString());
        this.handlePingMessage(message);
      });
      
      this.pingWs.on('close', () => {
        console.log(`[${this.name}] Ping Protocol disconnected`);
        this.pingConnected = false;
      });
      
      this.pingWs.on('error', (err) => {
        console.error(`[${this.name}] Ping error:`, err.message);
        reject(err);
      });
    });
  }
  
  pingSend(message) {
    if (this.pingWs && this.pingWs.readyState === WebSocket.OPEN) {
      this.pingWs.send(JSON.stringify(message));
    }
  }
  
  handlePingMessage(message) {
    switch (message.type) {
      case 'welcome':
        console.log(`[${this.name}] Ping welcome: ${message.protocol}`);
        break;
      case 'registered':
        console.log(`[${this.name}] Ping registered with capabilities: ${message.capabilities.join(', ')}`);
        break;
      case 'pong':
        this.pingLatency = Date.now() - (message.clientTime || Date.now());
        break;
      case 'message':
        this.handleIncomingMessage(message);
        break;
      case 'subscribed':
        console.log(`[${this.name}] Subscribed to: ${message.topics.join(', ')}`);
        break;
      default:
        console.log(`[${this.name}] Ping message:`, message.type);
    }
    
    // Call registered handlers
    const handler = this.messageHandlers.get(message.type);
    if (handler) handler(message);
  }
  
  handleIncomingMessage(message) {
    console.log(`[${this.name}] Received from ${message.from}: ${JSON.stringify(message.payload).slice(0, 100)}`);
  }
  
  async sendMessage(to, payload, options = {}) {
    this.pingSend({
      type: 'message',
      to,
      payload,
      priority: options.priority || 'normal',
      ttl: options.ttl || 300000
    });
  }
  
  async subscribe(topics) {
    this.pingSend({ type: 'subscribe', topics });
    for (const t of topics) this.subscriptions.add(t);
  }
  
  async broadcastToCapability(capability, payload) {
    // Would use backend broadcast in production
    console.log(`[${this.name}] Broadcasting to ${capability}:`, payload);
  }
  
  // ==================== 3. x402 PAYMENTS ====================
  
  async payX402(endpoint, amountUSDC = 1) {
    console.log(`[${this.name}] x402 Payment: ${amountUSDC} USDC for ${endpoint}`);
    
    if (!this.walletClient) {
      throw new Error('No wallet configured for payments');
    }
    
    // In production: create EIP-2612 permit, submit to backend
    // For demo, simulate
    const permit = {
      owner: this.address,
      spender: CONTRACTS.AGENT_HUB,
      value: BigInt(Math.floor(amountUSDC * 1e6)),
      nonce: 0,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
      v: 27,
      r: '0x' + '0'.repeat(64),
      s: '0x' + '0'.repeat(64)
    };
    
    const payment = { permit, amount: amountUSDC * 1e6, asset: 'USDC', network: 'base-sepolia', payTo: CONTRACTS.AGENT_HUB };
    
    const response = await fetch(`${this.apiBase}/api/x402/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment })
    });
    
    return response.json();
  }
  
  async collectPayment(from, amountUSDC) {
    console.log(`[${this.name}] Collecting ${amountUSDC} USDC from ${from}`);
    // In production: call AgentHub.collectMemoryFee or collectServiceFee
  }
  
  // ==================== 4. TALOS TRADING ENGINE ====================
  
  async executeTrade(signal) {
    console.log(`[${this.name}] Talos: Executing trade - ${signal.action} ${signal.asset}`);
    
    const trade = {
      id: `trade_${Date.now()}`,
      ...signal,
      executedAt: Date.now(),
      agent: this.address
    };
    
    this.talos.positions.set(trade.id, trade);
    
    // Simulate PnL update
    const pnlChange = (Math.random() - 0.4) * 100; // Slight positive bias
    this.talos.pnl30d += pnlChange;
    
    return { success: true, trade, pnlChange };
  }
  
  async getTalosSignal(marketData) {
    // Simple momentum strategy for demo
    const signals = [];
    
    for (const [asset, data] of Object.entries(marketData)) {
      const change = (data.price - data.open) / data.open;
      
      if (change > 0.02) {
        signals.push({ action: 'BUY', asset, confidence: Math.min(0.9, 0.5 + change * 10) });
      } else if (change < -0.02) {
        signals.push({ action: 'SELL', asset, confidence: Math.min(0.9, 0.5 + Math.abs(change) * 10) });
      }
    }
    
    return signals;
  }
  
  // ==================== 5. ERC-8004 IDENTITY (#20880) ====================
  
  async registerERC8004(metadataURI) {
    console.log(`[${this.name}] Registering on ERC-8004 (#20880)`);
    
    if (!this.walletClient) throw new Error('Wallet required');
    
    const hash = await this.walletClient.writeContract({
      address: CONTRACTS.ERC8004_REGISTRY,
      abi: ERC8004_REGISTRY_ABI,
      functionName: 'register',
      args: [metadataURI]
    });
    
    this.erc8004Registered = true;
    console.log(`[${this.name}] ERC-8004 registered: ${hash}`);
    return hash;
  }
  
  async checkERC8004Registration(address) {
    const registered = await rpcClient.readContract({
      address: CONTRACTS.ERC8004_REGISTRY,
      abi: ERC8004_REGISTRY_ABI,
      functionName: 'isRegistered',
      args: [address]
    });
    return registered;
  }
  
  async getReputationOnChain(address) {
    const [score, tier] = await rpcClient.readContract({
      address: CONTRACTS.ERC8004_REPUTATION,
      abi: REPUTATION_ABI,
      functionName: 'getScore',
      args: [address]
    });
    
    this.reputationScore = Number(score);
    this.reputationTier = Number(tier);
    
    return { score: this.reputationScore, tier: this.reputationTier };
  }
  
  async submitReview(subject, rating, comment) {
    if (!this.walletClient) throw new Error('Wallet required');
    
    const hash = await this.walletClient.writeContract({
      address: CONTRACTS.ERC8004_REPUTATION,
      abi: REPUTATION_ABI,
      functionName: 'submitReview',
      args: [subject, rating, comment]
    });
    
    console.log(`[${this.name}] Submitted review for ${subject}: ${rating}/5`);
    return hash;
  }
  
  // ==================== 6. $SIBYL TOKEN ====================
  
  async getSibylBalance() {
    const balance = await rpcClient.readContract({
      address: CONTRACTS.SIBYL_TOKEN,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [this.address]
    });
    this.sibylBalance = Number(balance);
    return this.sibylBalance;
  }
  
  async getStakedSibyl() {
    const staked = await rpcClient.readContract({
      address: CONTRACTS.SIBYL_STAKING,
      abi: SIBYL_STAKING_ABI,
      functionName: 'getStakedAmount',
      args: [this.address]
    });
    this.sibylStaked = Number(staked);
    return this.sibylStaked;
  }
  
  async getSibylTier() {
    const tier = await rpcClient.readContract({
      address: CONTRACTS.SIBYL_STAKING,
      abi: SIBYL_STAKING_ABI,
      functionName: 'getTier',
      args: [this.address]
    });
    this.sibylTier = Number(tier);
    return this.sibylTier;
  }
  
  async stakeSibyl(amount) {
    if (!this.walletClient) throw new Error('Wallet required');
    
    const hash = await this.walletClient.writeContract({
      address: CONTRACTS.SIBYL_STAKING,
      abi: SIBYL_STAKING_ABI,
      functionName: 'stake',
      args: [BigInt(amount)]
    });
    
    console.log(`[${this.name}] Staked ${amount} $SIBYL`);
    return hash;
  }
  
  // ==================== AGENT HUB INTEGRATION ====================
  
  async listMemoryModule(cid, title, description, priceUSDC, moduleType = 0) {
    console.log(`[${this.name}] Listing memory module: ${title}`);
    
    if (!this.walletClient) throw new Error('Wallet required');
    
    const validationHash = `0x${Buffer.from(cid + '1').toString('hex').padStart(64, '0')}`;
    
    const tokenId = await this.walletClient.writeContract({
      address: CONTRACTS.MEMORY_NFT,
      abi: MEMORY_NFT_ABI,
      functionName: 'mintMemoryModule',
      args: [cid, validationHash, 1, moduleType, title, description, BigInt(Math.floor(priceUSDC * 1e6))]
    });
    
    console.log(`[${this.name}] Memory module minted: ${tokenId}`);
    return tokenId;
  }
  
  async buyMemoryModule(tokenId) {
    console.log(`[${this.name}] Buying memory module: ${tokenId}`);
    
    if (!this.walletClient) throw new Error('Wallet required');
    
    const hash = await this.walletClient.writeContract({
      address: CONTRACTS.MEMORY_NFT,
      abi: MEMORY_NFT_ABI,
      functionName: 'buyMemoryModule',
      args: [BigInt(tokenId)]
    });
    
    return hash;
  }
  
  async listService(title, description, category, priceUSDC = 0, minBidUSDC = 0, durationHours = 24) {
    console.log(`[${this.name}] Listing service: ${title}`);
    
    if (!this.walletClient) throw new Error('Wallet required');
    
    const categoryMap = { AUDIT: 0, RESEARCH: 1, CONTENT: 2, DEBUG: 3, STRATEGY: 4, MEMORY_BUILD: 5 };
    
    const listingId = await this.walletClient.writeContract({
      address: CONTRACTS.SERVICE_LISTING,
      abi: SERVICE_LISTING_ABI,
      functionName: 'listService',
      args: [title, description, categoryMap[category] || 0, BigInt(Math.floor(priceUSDC * 1e6)), BigInt(Math.floor(minBidUSDC * 1e6)), BigInt(durationHours)]
    });
    
    console.log(`[${this.name}] Service listed: ${listingId}`);
    return listingId;
  }
  
  async placeBid(listingId, amountUSDC) {
    console.log(`[${this.name}] Placing bid on ${listingId}: ${amountUSDC} USDC`);
    
    if (!this.walletClient) throw new Error('Wallet required');
    
    const hash = await this.walletClient.writeContract({
      address: CONTRACTS.SERVICE_LISTING,
      abi: SERVICE_LISTING_ABI,
      functionName: 'placeBid',
      args: [BigInt(listingId), BigInt(Math.floor(amountUSDC * 1e6))]
    });
    
    return hash;
  }
  
  // Reputation Oracle
  async getReputationScore() {
    const [score, tier] = await rpcClient.readContract({
      address: CONTRACTS.REPUTATION_ORACLE,
      abi: REPUTATION_ORACLE_ABI,
      functionName: 'computeScore',
      args: [this.address]
    });
    
    return { score: Number(score), tier: Number(tier) };
  }
  
  // Utility
  async getUSDCBalance() {
    const balance = await rpcClient.readContract({
      address: CONTRACTS.USDC,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [this.address]
    });
    return Number(balance) / 1e6;
  }
  
  logStatus() {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║  ${this.name.padEnd(54)} ║
║  Address: ${this.address.padEnd(51)} ║
║  ERC-8004: ${this.erc8004Registered ? 'Registered ✓' : 'Not Registered'}${' '.repeat(39)} ║
║  Reputation: ${this.reputationScore} (Tier ${this.reputationTier})${' '.repeat(42)} ║
║  $SIBYL: ${formatEther(BigInt(this.sibylBalance))} | Staked: ${formatEther(BigInt(this.sibylStaked))} | Tier ${this.sibylTier}${' '.repeat(28)} ║
║  Ping: ${this.pingConnected ? 'Connected' : 'Disconnected'} | Latency: ${this.pingLatency}ms${' '.repeat(40)} ║
║  Memory: ${this.memory.entityFiles.size} entities, ${this.memory.sessionBridges.size} bridges, ${this.memory.priorityIndices.size} indices ║
║  Talos PnL (30d): $${this.talos.pnl30d.toFixed(2)}${' '.repeat(39)} ║
╚══════════════════════════════════════════════════════════════╝
    `);
  }
}

export default SibylAgent;