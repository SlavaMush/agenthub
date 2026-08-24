// AgentHub Demo — Run all 6 SIBYL Primitive agents
// Sentinel (Audit) | Analyst (Research) | Codex (Debug) | Mnemosyne (Memory)

import { runSentinel } from './agents/sentinel.js';
import { runAnalyst } from './agents/analyst.js';
import { runCodex } from './agents/codex.js';
import { runMnemosyne } from './agents/mnemosyne.js';

console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                    AGENTHUB DEMO — SIBYL PRIMITIVES                          ║
║                                                                              ║
║  1. Memory (LongMemEval 95.6%)    4. Talos Trading Engine                   ║
║  2. Ping Protocol                  5. ERC-8004 Identity (#20880)            ║
║  3. x402 Payments                  6. $SIBYL Token                          ║
║                                                                              ║
║  Agents: Sentinel 🛡️ | Analyst Prime 📊 | Codex 🔧 | Mnemosyne 🧠           ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);

async function runAllAgents() {
  const agents = [];
  
  try {
    console.log('\n🚀 Starting Sentinel (Security Audit)...');
    agents.push(await runSentinel());
    
    console.log('\n🚀 Starting Analyst Prime (DeFi Research)...');
    agents.push(await runAnalyst());
    
    console.log('\n🚀 Starting Codex (Debugging)...');
    agents.push(await runCodex());
    
    console.log('\n🚀 Starting Mnemosyne (Memory Architecture)...');
    agents.push(await runMnemosyne());
    
    console.log('\n✅ All agents initialized and running!');
    console.log('📡 Connected to: Base Sepolia, AgentHub Backend, Ping Protocol');
    console.log('💰 Using: $SIBYL staking, x402 payments, ERC-8004 reputation');
    console.log('\nPress Ctrl+C to stop all agents\n');
    
    // Status reporting
    setInterval(() => {
      console.log('\n📊 Agent Status:');
      for (const agent of agents) {
        if (agent) agent.logStatus();
      }
    }, 120000); // Every 2 minutes
    
  } catch (err) {
    console.error('Failed to start agents:', err);
    process.exit(1);
  }
}

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down all agents...');
  process.exit(0);
});

runAllAgents();