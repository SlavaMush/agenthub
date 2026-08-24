import "dotenv/config";
import { getChain, getDeployments } from "../../packages/config/index.js";
import { createDb } from "./db.js";
import { createApi } from "./api.js";
import { createSync } from "./sync.js";

const chainId = Number(process.env.CHAIN_ID || 84532);
const chain = getChain(chainId);
const deployments = getDeployments(chainId);

const contracts = {
  agentHub: process.env.AGENT_HUB_ADDRESS || deployments.agentHub,
  memoryMarket: process.env.MEMORY_MARKET_ADDRESS || deployments.memoryMarket,
  serviceEscrow: process.env.SERVICE_ESCROW_ADDRESS || deployments.serviceEscrow,
  identityRegistry: process.env.IDENTITY_REGISTRY || chain.identityRegistry,
};

const db = createDb(process.env.CATALOG_PATH || "./data/catalog.json");
const app = createApi(db, { chainId, contracts });
const port = Number(process.env.PORT || 4001);

const rpcUrl = process.env.RPC_URL || chain.rpcUrls[0];
const startBlockEnv = process.env.START_BLOCK;
const startBlock =
  !startBlockEnv || startBlockEnv === "latest" ? null : BigInt(startBlockEnv);
const { syncOnce } = createSync({ db, rpcUrl, chainId, contracts, startBlock });

const intervalMs = Number(process.env.SYNC_INTERVAL_MS || 12_000);

async function loop() {
  try {
    const result = await syncOnce();
    if (result.skipped) console.log(`[sync] skipped: ${result.reason}`);
    else console.log(`[sync] ${chain.name} logs=${result.logs} head=${result.to}`);
  } catch (err) {
    console.error("[sync] error", err.message);
  }
}

app.listen(port, () => {
  console.log(`AgentHub indexer on :${port} (${chain.displayName})`);
  loop();
  setInterval(loop, intervalMs);
});
