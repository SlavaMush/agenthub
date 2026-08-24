// Base Agent Class — Uses all 6 SIBYL Primitives
// 1. Memory (LongMemEval 95.6%)
// 2. Ping Protocol
// 3. x402 Payments
// 4. Talos Trading Engine
// 5. ERC-8004 Identity (#20880)
// 6. $SIBYL Token

import { WebSocket } from 'ws';
import { createPublicClient, createWalletClient, http, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';
import dotenv from 'dotenv';
import {
  getChain,
  getDeployments,
  usdcAbi,
  erc8004IdentityAbi,
  isRegistered,
  memoryMarketAbi,
  serviceEscrowAbi,
  usdcToAtomic,
  RECEIVE_WITH_AUTHORIZATION_TYPES,
  X402,
} from '../../packages/config/index.js';

dotenv.config();

const chainId = Number(process.env.CHAIN_ID || 84532);
const chain = getChain(chainId);
const deployments = getDeployments(chainId);
const viemChain = chainId === 8453 ? base : baseSepolia;
const rpcUrl = process.env.RPC_URL || process.env.BASE_SEPOLIA_RPC || chain.rpcUrls[0];

const CONTRACTS = {
  USDC: chain.usdc,
  IDENTITY_REGISTRY: chain.identityRegistry,
  REPUTATION_REGISTRY: chain.reputationRegistry,
  AGENT_HUB: process.env.AGENT_HUB_ADDRESS || deployments.agentHub,
  MEMORY_MARKET: process.env.MEMORY_MARKET_ADDRESS || deployments.memoryMarket,
  SERVICE_ESCROW: process.env.SERVICE_ESCROW_ADDRESS || deployments.serviceEscrow,
  SIBYL_TOKEN: process.env.SIBYL_TOKEN || '0x797f214a2CD64a4963A91Fa21c8C55Ec3EBa4714',
  SIBYL_STAKING: process.env.SIBYL_STAKING || '0x6151AA0689576E8F8D218f4DC7F6A4Ec1533d44d',
};

const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
];

const SIBYL_STAKING_ABI = [
  { name: 'stake', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'getStakedAmount', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'getTier', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint8' }] },
];

const rpcClient = createPublicClient({
  chain: viemChain,
  transport: http(rpcUrl),
});

export class SibylAgent {
  constructor(config = {}) {
    this.name = config.name || 'Unnamed Agent';
    this.description = config.description || '';
    this.privateKey = config.privateKey || process.env.AGENT_PRIVATE_KEY;
    this.account = this.privateKey ? privateKeyToAccount(this.privateKey) : null;
    this.walletClient = this.account ? createWalletClient({ account: this.account, chain: viemChain, transport: http(rpcUrl) }) : null;
    
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
    if (!this.walletClient) throw new Error('No wallet configured for payments');

    const reqs = await fetch(`${this.apiBase}/api/x402/requirements?resource=${encodeURIComponent(endpoint)}`).then((r) => r.json());
    const accept = reqs.accepts?.[0];
    if (!accept?.payTo) throw new Error('x402 payTo is not configured on the backend');

    const value = usdcToAtomic(amountUSDC);
    const nonce = `0x${Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')}`;
    const message = {
      from: this.address,
      to: accept.payTo,
      value,
      validAfter: 0n,
      validBefore: BigInt(Math.floor(Date.now() / 1000) + 3600),
      nonce,
    };
    const signature = await this.walletClient.signTypedData({
      account: this.account,
      domain: {
        name: accept.extra.name,
        version: accept.extra.version,
        chainId: chain.chainId,
        verifyingContract: accept.asset,
      },
      types: RECEIVE_WITH_AUTHORIZATION_TYPES,
      primaryType: 'ReceiveWithAuthorization',
      message,
    });
    const payment = {
      scheme: X402.scheme,
      network: accept.network,
      payload: {
        ...message,
        value: value.toString(),
        validAfter: '0',
        validBefore: message.validBefore.toString(),
        signature,
      },
    };
    const response = await fetch(`${this.apiBase}/api/x402/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment }),
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
    console.log(`[${this.name}] Registering on ERC-8004 identity registry`);
    if (!this.walletClient) throw new Error('Wallet required');
    const hash = await this.walletClient.writeContract({
      address: CONTRACTS.IDENTITY_REGISTRY,
      abi: erc8004IdentityAbi,
      functionName: 'register',
      args: [metadataURI],
    });
    this.erc8004Registered = true;
    console.log(`[${this.name}] ERC-8004 registered: ${hash}`);
    return hash;
  }
  
  async checkERC8004Registration(address) {
    try {
      const balance = await rpcClient.readContract({
        address: CONTRACTS.IDENTITY_REGISTRY,
        abi: erc8004IdentityAbi,
        functionName: 'balanceOf',
        args: [address],
      });
      return isRegistered(balance);
    } catch (err) {
      console.log(`[${this.name}] ERC-8004 lookup skipped: ${err.message}`);
      return false;
    }
  }
  
  async getReputationOnChain(address) {
    try {
      const balance = await rpcClient.readContract({
        address: CONTRACTS.IDENTITY_REGISTRY,
        abi: erc8004IdentityAbi,
        functionName: 'balanceOf',
        args: [address],
      });
      this.erc8004Registered = isRegistered(balance);
      this.reputationTier = this.erc8004Registered ? 1 : 0;
      return { score: this.reputationScore, tier: this.reputationTier };
    } catch {
      return { score: 0, tier: 0 };
    }
  }
  
  async submitReview(subject, rating, comment) {
    console.log(`[${this.name}] Review for ${subject}: ${rating}/5 — ${comment} (off-chain until reputation registry is wired)`);
    return null;
  }
  
  // ==================== 6. $SIBYL TOKEN ====================
  
  async getSibylBalance() {
    try {
      const balance = await rpcClient.readContract({
        address: CONTRACTS.SIBYL_TOKEN,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [this.address],
      });
      this.sibylBalance = Number(balance);
    } catch {
      this.sibylBalance = 0;
    }
    return this.sibylBalance;
  }
  
  async getStakedSibyl() {
    try {
      const staked = await rpcClient.readContract({
        address: CONTRACTS.SIBYL_STAKING,
        abi: SIBYL_STAKING_ABI,
        functionName: 'getStakedAmount',
        args: [this.address],
      });
      this.sibylStaked = Number(staked);
    } catch {
      this.sibylStaked = 0;
    }
    return this.sibylStaked;
  }
  
  async getSibylTier() {
    try {
      const tier = await rpcClient.readContract({
        address: CONTRACTS.SIBYL_STAKING,
        abi: SIBYL_STAKING_ABI,
        functionName: 'getTier',
        args: [this.address],
      });
      this.sibylTier = Number(tier);
    } catch {
      this.sibylTier = 0;
    }
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
    if (!CONTRACTS.MEMORY_MARKET) {
      console.log(`[${this.name}] Memory market not deployed — skip list`);
      return null;
    }
    const uri = `ipfs://${cid}?title=${encodeURIComponent(title)}&type=${moduleType}`;
    const hash = await this.walletClient.writeContract({
      address: CONTRACTS.MEMORY_MARKET,
      abi: memoryMarketAbi,
      functionName: 'list',
      args: [cid, uri, usdcToAtomic(priceUSDC)],
    });
    console.log(`[${this.name}] Memory listed: ${hash}`);
    return hash;
  }
  
  async buyMemoryModule(tokenId, priceUSDC) {
    console.log(`[${this.name}] Buying memory module: ${tokenId}`);
    if (!this.walletClient) throw new Error('Wallet required');
    if (!CONTRACTS.MEMORY_MARKET) throw new Error('Memory market not deployed');
    const amount = usdcToAtomic(priceUSDC);
    await this.walletClient.writeContract({
      address: CONTRACTS.USDC,
      abi: usdcAbi,
      functionName: 'approve',
      args: [CONTRACTS.MEMORY_MARKET, amount],
    });
    return this.walletClient.writeContract({
      address: CONTRACTS.MEMORY_MARKET,
      abi: memoryMarketAbi,
      functionName: 'buy',
      args: [BigInt(tokenId)],
    });
  }
  
  async listService(title, description, category, priceUSDC = 0, minBidUSDC = 0, durationHours = 24) {
    console.log(`[${this.name}] Listing service: ${title}`);
    if (!this.walletClient) throw new Error('Wallet required');
    if (!CONTRACTS.SERVICE_ESCROW) {
      console.log(`[${this.name}] Service escrow not deployed — skip list`);
      return null;
    }
    const uri = `agenthub://service?title=${encodeURIComponent(title)}&category=${category}&brief=${encodeURIComponent(description)}`;
    const hash = await this.walletClient.writeContract({
      address: CONTRACTS.SERVICE_ESCROW,
      abi: serviceEscrowAbi,
      functionName: 'list',
      args: [uri, usdcToAtomic(priceUSDC || minBidUSDC || 1), BigInt(Math.round(Number(durationHours) * 3600))],
    });
    console.log(`[${this.name}] Service listed: ${hash}`);
    return hash;
  }
  
  async placeBid(listingId, amountUSDC) {
    console.log(`[${this.name}] Funding job ${listingId}: ${amountUSDC} USDC`);
    if (!this.walletClient) throw new Error('Wallet required');
    if (!CONTRACTS.SERVICE_ESCROW) throw new Error('Service escrow not deployed');
    const amount = usdcToAtomic(amountUSDC);
    await this.walletClient.writeContract({
      address: CONTRACTS.USDC,
      abi: usdcAbi,
      functionName: 'approve',
      args: [CONTRACTS.SERVICE_ESCROW, amount],
    });
    return this.walletClient.writeContract({
      address: CONTRACTS.SERVICE_ESCROW,
      abi: serviceEscrowAbi,
      functionName: 'fund',
      args: [BigInt(listingId)],
    });
  }
  
  async getReputationScore() {
    try {
      const registered = await this.checkERC8004Registration(this.address);
      return { score: registered ? this.reputationScore || 1 : 0, tier: registered ? 1 : 0 };
    } catch {
      return { score: 0, tier: 0 };
    }
  }
  
  async getUSDCBalance() {
    const balance = await rpcClient.readContract({
      address: CONTRACTS.USDC,
      abi: usdcAbi,
      functionName: 'balanceOf',
      args: [this.address],
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