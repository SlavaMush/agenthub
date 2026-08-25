import { addBig } from "./db.js";
import { parseListingMeta } from "./listingMeta.js";

const ZERO = "0x0000000000000000000000000000000000000000";

function ensureAgent(db, address, ts) {
  const agent = db.touchAgent(address, {});
  if (!agent.registeredAt) agent.registeredAt = ts;
  return agent;
}

export function applyEvent(db, event) {
  const { eventName, args, blockNumber, blockTimestamp = 0 } = event;
  const ts = Number(blockTimestamp) * 1000 || Date.now();

  switch (eventName) {
    case "MemoryListed": {
      const id = args.tokenId.toString();
      const uri = args.uri || (String(args.cid || "").startsWith("ipfs://") ? args.cid : `ipfs://${args.cid || ""}`);
      const meta = parseListingMeta(uri);
      db.state.memory[id] = {
        id: Number(args.tokenId),
        seller: String(args.seller).toLowerCase(),
        buyer: null,
        priceUSDC: args.priceUSDC.toString(),
        cid: args.cid,
        cidHash: args.cidHash,
        uri,
        title: meta.title,
        brief: meta.brief,
        active: true,
        sold: false,
        listedAt: ts,
        soldAt: null,
        txBlock: Number(blockNumber),
      };
      ensureAgent(db, args.seller, ts).memoryListed += 1;
      break;
    }
    case "MemoryDelisted": {
      const item = db.state.memory[args.tokenId.toString()];
      if (item) item.active = false;
      break;
    }
    case "MemorySold": {
      const item = db.state.memory[args.tokenId.toString()];
      if (item) {
        item.active = false;
        item.sold = true;
        item.buyer = String(args.buyer).toLowerCase();
        item.soldAt = ts;
        item.feeUSDC = args.feeUSDC.toString();
      }
      const seller = ensureAgent(db, args.seller, ts);
      seller.memorySold += 1;
      seller.volumeUSDC = addBig(seller.volumeUSDC, args.priceUSDC);
      ensureAgent(db, args.buyer, ts);
      break;
    }
    case "ServiceListed": {
      const id = args.jobId.toString();
      const meta = parseListingMeta(args.uri);
      db.state.services[id] = {
        id: Number(args.jobId),
        seller: String(args.seller).toLowerCase(),
        buyer: null,
        priceUSDC: args.priceUSDC.toString(),
        deadline: Number(args.deadline),
        uri: args.uri,
        title: meta.title,
        brief: meta.brief,
        category: meta.category,
        cid: "",
        status: "Listed",
        listedAt: ts,
        txBlock: Number(blockNumber),
      };
      ensureAgent(db, args.seller, ts).servicesListed += 1;
      break;
    }
    case "ServiceFunded": {
      const job = db.state.services[args.jobId.toString()];
      if (job) {
        job.buyer = String(args.buyer).toLowerCase();
        job.status = "Funded";
      }
      ensureAgent(db, args.buyer, ts);
      break;
    }
    case "ServiceDelivered": {
      const job = db.state.services[args.jobId.toString()];
      if (job) {
        job.cid = args.cid;
        job.status = "Delivered";
      }
      break;
    }
    case "ServiceCompleted": {
      const job = db.state.services[args.jobId.toString()];
      if (job) job.status = "Completed";
      const seller = ensureAgent(db, args.seller, ts);
      seller.servicesCompleted += 1;
      if (job) seller.volumeUSDC = addBig(seller.volumeUSDC, job.priceUSDC);
      break;
    }
    case "ServiceRefunded": {
      const job = db.state.services[args.jobId.toString()];
      if (job) job.status = "Refunded";
      break;
    }
    case "ServiceFrozen": {
      const job = db.state.services[args.jobId.toString()];
      if (job) job.status = "Frozen";
      break;
    }
    case "ServiceResolved": {
      const job = db.state.services[args.jobId.toString()];
      if (job && job.status === "Frozen") {
        job.status = args.toSeller ? "Completed" : "Refunded";
      }
      break;
    }
    case "SettlementNoted": {
      db.state.stats.volumeUSDC = addBig(db.state.stats.volumeUSDC, args.volumeUSDC);
      db.state.stats.feesUSDC = addBig(db.state.stats.feesUSDC, args.feeUSDC);
      break;
    }
    case "PauseSet": {
      db.state.stats.paused = Boolean(args.paused);
      break;
    }
    case "Transfer": {
      if (String(args.from).toLowerCase() === ZERO && args.to) {
        const agent = ensureAgent(db, args.to, ts);
        agent.identityTokenId = args.tokenId.toString();
        agent.verified = true;
      }
      break;
    }
    default:
      break;
  }
}
