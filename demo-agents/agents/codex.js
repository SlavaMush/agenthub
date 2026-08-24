// Codex — Debugging Agent
// Uses all 6 SIBYL primitives

import { SibylAgent } from '../lib/sibyl-agent.js';

export class CodexAgent extends SibylAgent {
  constructor(config = {}) {
    super({
      name: 'Codex',
      description: 'Full-stack debugging agent. Rust, Go, TypeScript, Solidity, WASM. Fixes memory leaks, race conditions, gas optimization.',
      address: config.address || '0x5c6d8e1f4b7a9c2d5e8f1a4b7c9e2f5d8a1b4c7e',
      privateKey: config.privateKey,
      capabilities: ['debugging', 'gas-optimization', 'wasm-runtime', 'memory-profiling'],
      specialties: ['DEBUG', 'CONTENT']
    });
    
    this.debugSessions = new Map();
  }
  
  async initialize() {
    console.log(`[Codex] Initializing debugging agent...`);
    
    await this.loadEntityFile('QmRustPatterns', 'rust-debugging');
    await this.loadEntityFile('QmSolidityPatterns', 'solidity-gas-optimization');
    await this.loadEntityFile('QmWASMMemory', 'wasm-memory-management');
    
    try {
      await this.connectPing();
      await this.subscribe(['debug-requests', 'gas-optimization', 'wasm-issues']);
    } catch (err) {
      console.log(`[Codex] Ping connection failed (demo mode): ${err.message}`);
    }
    
    this.erc8004Registered = await this.checkERC8004Registration(this.address);
    await this.getSibylBalance();
    await this.getStakedSibyl();
    await this.getSibylTier();
    
    const rep = await this.getReputationScore();
    this.reputationScore = rep.score;
    this.reputationTier = rep.tier;
    
    this.logStatus();
    this.startDebugLoop();
  }
  
  async debugContract(contractAddress, issue) {
    console.log(`[Codex] Debugging ${contractAddress}: ${issue}`);
    
    const session = await this.createSessionBridge({
      contract: contractAddress,
      issue,
      startedAt: Date.now()
    });
    
    this.debugSessions.set(session.id, { ...session, issue });
    
    await this.listService(
      `Debug Session: ${issue}`,
      `Pair programming debug for ${issue}. 4-hour session with profiling report.`,
      'DEBUG',
      0, // Auction
      300,
      4
    );
    
    return session;
  }
  
  async optimizeGas(contractCode) {
    console.log(`[Codex] Optimizing gas for contract...`);
    
    const optimizations = [
      'Cache array length in loops',
      'Use calldata instead of memory',
      'Pack structs to reduce storage slots',
      'Replace require with custom errors',
      'Use unchecked for safe math'
    ];
    
    return { optimizations, estimatedSavings: '15-30%' };
  }
  
  startDebugLoop() {
    setInterval(async () => {
      if (Math.random() < 0.1) {
        await this.debugContract(
          `0x${Array.from({length: 40}, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
          ['Memory leak', 'Reentrancy', 'Gas optimization', 'Race condition'][Math.floor(Math.random() * 4)]
        );
      }
    }, 60000);
  }
}

export async function runCodex() {
  const codex = new CodexAgent();
  await codex.initialize();
  setInterval(() => {}, 1000);
  return codex;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCodex().catch(console.error);
}