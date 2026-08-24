import express from "express";
import cors from "cors";
import { atomicToUsdc } from "../../packages/config/index.js";

function paginate(list, query) {
  const limit = Math.min(parseInt(query.limit || "50", 10), 200);
  const offset = parseInt(query.offset || "0", 10);
  return { items: list.slice(offset, offset + limit), total: list.length, limit, offset };
}

export function createApi(db, meta = {}) {
  const app = express();
  app.use(cors());

  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      cursor: db.state.cursor,
      chainId: meta.chainId || null,
      paused: db.state.stats.paused,
      contracts: meta.contracts || {},
    });
  });

  app.get("/stats", (req, res) => {
    res.json({
      ...db.state.stats,
      volume: atomicToUsdc(db.state.stats.volumeUSDC),
      fees: atomicToUsdc(db.state.stats.feesUSDC),
      memory: Object.keys(db.state.memory).length,
      services: Object.keys(db.state.services).length,
      agents: Object.keys(db.state.agents).length,
    });
  });

  app.get("/memory", (req, res) => {
    let list = Object.values(db.state.memory);
    if (req.query.seller) list = list.filter((m) => m.seller === String(req.query.seller).toLowerCase());
    if (req.query.active === "true") list = list.filter((m) => m.active);
    if (req.query.sold === "true") list = list.filter((m) => m.sold);
    if (req.query.sold === "false") list = list.filter((m) => !m.sold);
    list.sort((a, b) => b.listedAt - a.listedAt);
    const page = paginate(list, req.query);
    res.json({ modules: page.items, total: page.total, limit: page.limit, offset: page.offset });
  });

  app.get("/memory/:id", (req, res) => {
    const item = db.state.memory[req.params.id];
    if (!item) return res.status(404).json({ error: "not found" });
    res.json(item);
  });

  app.get("/services", (req, res) => {
    let list = Object.values(db.state.services);
    if (req.query.seller) list = list.filter((s) => s.seller === String(req.query.seller).toLowerCase());
    if (req.query.status) list = list.filter((s) => s.status === req.query.status);
    list.sort((a, b) => b.listedAt - a.listedAt);
    const page = paginate(list, req.query);
    res.json({ listings: page.items, total: page.total, limit: page.limit, offset: page.offset });
  });

  app.get("/services/:id", (req, res) => {
    const item = db.state.services[req.params.id];
    if (!item) return res.status(404).json({ error: "not found" });
    res.json(item);
  });

  app.get("/agents", (req, res) => {
    let list = Object.values(db.state.agents);
    if (req.query.verified === "true") list = list.filter((a) => a.verified);
    list.sort((a, b) => Number(b.volumeUSDC) - Number(a.volumeUSDC));
    const page = paginate(list, req.query);
    res.json({ agents: page.items, total: page.total, limit: page.limit, offset: page.offset });
  });

  app.get("/agents/:address", (req, res) => {
    const item = db.state.agents[req.params.address.toLowerCase()];
    if (!item) return res.status(404).json({ error: "not found" });
    res.json(item);
  });

  return app;
}
