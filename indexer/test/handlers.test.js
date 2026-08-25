import { test } from "node:test";
import assert from "node:assert/strict";
import { createDb } from "../src/db.js";
import { applyEvent } from "../src/handlers.js";
import { createApi } from "../src/api.js";

const seller = "0x1111111111111111111111111111111111111111";
const buyer = "0x2222222222222222222222222222222222222222";

function ev(eventName, args) {
  return { eventName, args, blockNumber: 10n, blockTimestamp: 1_700_000_000 };
}

async function getJson(app, path) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  const json = await res.json();
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  return json;
}

test("indexes memory list and sale", async () => {
  const db = createDb(null);
  applyEvent(db, ev("MemoryListed", {
    tokenId: 0n,
    seller,
    priceUSDC: 150_000000n,
    cidHash: "0xabc",
    cid: "bafy-memory",
  }));
  applyEvent(db, ev("MemorySold", {
    tokenId: 0n,
    buyer,
    seller,
    priceUSDC: 150_000000n,
    feeUSDC: 15_000000n,
  }));
  applyEvent(db, ev("SettlementNoted", {
    market: "0x3333333333333333333333333333333333333333",
    volumeUSDC: 150_000000n,
    feeUSDC: 15_000000n,
  }));

  const item = db.state.memory["0"];
  assert.equal(item.sold, true);
  assert.equal(item.buyer, buyer);
  assert.equal(db.state.agents[seller].memorySold, 1);
  assert.equal(db.state.stats.volumeUSDC, "150000000");

  const body = await getJson(createApi(db, { chainId: 84532 }), "/memory?sold=true");
  assert.equal(body.total, 1);
  assert.equal(body.modules[0].cid, "bafy-memory");

  const stats = await getJson(createApi(db, { chainId: 84532 }), "/stats");
  assert.equal(stats.volume, 150);
  assert.equal(stats.fees, 15);
});

test("indexes service lifecycle and identity mint", async () => {
  const db = createDb(null);
  const agent = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  applyEvent(db, ev("Transfer", {
    from: "0x0000000000000000000000000000000000000000",
    to: agent,
    tokenId: 7n,
  }));
  applyEvent(db, ev("ServiceListed", {
    jobId: 1n,
    seller: agent,
    priceUSDC: 25_000000n,
    deadline: 1_700_086_400n,
    uri: "ipfs://job",
  }));
  applyEvent(db, ev("ServiceFunded", {
    jobId: 1n,
    buyer,
    priceUSDC: 25_000000n,
  }));
  applyEvent(db, ev("ServiceDelivered", {
    jobId: 1n,
    seller: agent,
    cid: "bafy-delivery",
  }));
  applyEvent(db, ev("ServiceCompleted", {
    jobId: 1n,
    seller: agent,
    sellerAmount: 23_750000n,
    feeUSDC: 1_250000n,
  }));

  const job = db.state.services["1"];
  assert.equal(job.status, "Completed");
  assert.equal(job.cid, "bafy-delivery");
  assert.equal(db.state.agents[agent].verified, true);
  assert.equal(db.state.agents[agent].identityTokenId, "7");
  assert.equal(db.state.agents[agent].servicesCompleted, 1);

  const services = await getJson(createApi(db, { chainId: 84532 }), "/services?status=Completed");
  assert.equal(services.total, 1);
  assert.equal(services.listings[0].cid, "bafy-delivery");

  const agents = await getJson(createApi(db, { chainId: 84532 }), "/agents?verified=true");
  assert.equal(agents.total, 1);
  assert.equal(agents.agents[0].identityTokenId, "7");
});

test("filters by buyer and parses listing titles", async () => {
  const db = createDb(null);
  applyEvent(db, ev("MemoryListed", {
    tokenId: 3n,
    seller,
    priceUSDC: 80_000000n,
    cidHash: "0xdef",
    cid: "bafy-mod",
    uri: "ipfs://bafy-mod?title=Session%20bridge",
  }));
  applyEvent(db, ev("MemorySold", {
    tokenId: 3n,
    buyer,
    seller,
    priceUSDC: 80_000000n,
    feeUSDC: 8_000000n,
  }));
  applyEvent(db, ev("ServiceListed", {
    jobId: 9n,
    seller,
    priceUSDC: 10_000000n,
    deadline: 1_700_086_400n,
    uri: "agenthub://service?title=Audit&brief=Review%20vault",
  }));
  applyEvent(db, ev("ServiceFunded", {
    jobId: 9n,
    buyer,
    priceUSDC: 10_000000n,
  }));

  const api = createApi(db, { chainId: 84532 });
  const memory = await getJson(api, `/memory?buyer=${buyer}`);
  assert.equal(memory.total, 1);
  assert.equal(memory.modules[0].title, "Session bridge");

  const hired = await getJson(api, `/services?buyer=${buyer}`);
  assert.equal(hired.total, 1);
  assert.equal(hired.listings[0].title, "Audit");
  assert.equal(hired.listings[0].brief, "Review vault");

  const other = await getJson(api, "/memory?buyer=0x3333333333333333333333333333333333333333");
  assert.equal(other.total, 0);
});
