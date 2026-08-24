import { createPublicClient, decodeEventLog, http } from "viem";
import { base, baseSepolia } from "viem/chains";
import {
  getChain,
  memoryMarketAbi,
  serviceEscrowAbi,
  agentHubAbi,
  erc8004IdentityAbi,
} from "../../packages/config/index.js";
import { applyEvent } from "./handlers.js";

const CHUNK = 2_000n;

export function createSync({ db, rpcUrl, chainId, contracts, startBlock = null }) {
  const client = createPublicClient({
    chain: chainId === 8453 ? base : baseSepolia,
    transport: http(rpcUrl),
  });

  function abiFor(address) {
    const addr = address.toLowerCase();
    if (contracts.memoryMarket && addr === contracts.memoryMarket.toLowerCase()) return memoryMarketAbi;
    if (contracts.serviceEscrow && addr === contracts.serviceEscrow.toLowerCase()) return serviceEscrowAbi;
    if (contracts.agentHub && addr === contracts.agentHub.toLowerCase()) return agentHubAbi;
    if (contracts.identityRegistry && addr === contracts.identityRegistry.toLowerCase()) return erc8004IdentityAbi;
    return null;
  }

  async function syncOnce() {
    const addresses = [
      contracts.memoryMarket,
      contracts.serviceEscrow,
      contracts.agentHub,
      contracts.identityRegistry,
    ].filter((addr) => typeof addr === "string" && /^0x[0-9a-fA-F]{40}$/.test(addr));

    if (addresses.length === 0) {
      return { skipped: true, reason: "no contract addresses configured" };
    }

    const head = await client.getBlockNumber();
    let from;
    if (db.state.cursor > 0) {
      from = BigInt(db.state.cursor);
    } else if (startBlock != null) {
      from = startBlock;
    } else {
      // Unconfigured START_BLOCK: follow the chain tip. Never scan genesis.
      from = head;
    }
    if (from > head) return { from: from.toString(), to: head.toString(), logs: 0, skipped: false };

    const startedFrom = from;
    let logsApplied = 0;
    while (from <= head) {
      const to = from + CHUNK > head ? head : from + CHUNK;
      const logs = await client.getLogs({ address: addresses, fromBlock: from, toBlock: to });
      const timestampCache = new Map();

      for (const log of logs) {
        const abi = abiFor(log.address);
        if (!abi) continue;
        let parsed;
        try {
          parsed = decodeEventLog({ abi, data: log.data, topics: log.topics, strict: false });
        } catch {
          continue;
        }
        let blockTimestamp = timestampCache.get(log.blockNumber);
        if (blockTimestamp === undefined) {
          const block = await client.getBlock({ blockNumber: log.blockNumber });
          blockTimestamp = Number(block.timestamp);
          timestampCache.set(log.blockNumber, blockTimestamp);
        }
        const args = { ...parsed.args };
        if (parsed.eventName === "MemoryListed" && contracts.memoryMarket && args.tokenId != null) {
          try {
            args.uri = await client.readContract({
              address: contracts.memoryMarket,
              abi: memoryMarketAbi,
              functionName: "tokenURI",
              args: [args.tokenId],
            });
          } catch {
            // URI is optional metadata; the listing event still indexes.
          }
        }
        applyEvent(db, {
          eventName: parsed.eventName,
          eventName: parsed.eventName,
          args,
          blockNumber: log.blockNumber,
          blockTimestamp,
        });
        logsApplied += 1;
      }

      db.state.cursor = Number(to + 1n);
      db.persist();
      from = to + 1n;
    }

    return { from: startedFrom.toString(), to: head.toString(), logs: logsApplied, chain: getChain(chainId).name };
  }

  return { client, syncOnce };
}
