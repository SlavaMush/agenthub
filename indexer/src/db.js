import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";

export function emptyState() {
  return {
    cursor: 0,
    memory: {},
    services: {},
    agents: {},
    stats: { volumeUSDC: "0", feesUSDC: "0", paused: false },
  };
}

export function createDb(filePath) {
  let state = emptyState();
  if (filePath) {
    mkdirSync(dirname(filePath), { recursive: true });
    if (existsSync(filePath)) {
      try {
        state = { ...emptyState(), ...JSON.parse(readFileSync(filePath, "utf8")) };
      } catch {
        state = emptyState();
      }
    }
  }

  function persist() {
    if (!filePath) return;
    writeFileSync(filePath, JSON.stringify(state, null, 2));
  }

  return {
    state,
    persist,
    touchAgent(address, patch = {}) {
      const key = address.toLowerCase();
      const existing = state.agents[key] || {
        address: key,
        memoryListed: 0,
        memorySold: 0,
        servicesListed: 0,
        servicesCompleted: 0,
        volumeUSDC: "0",
        registeredAt: 0,
        identityTokenId: null,
        verified: false,
      };
      state.agents[key] = { ...existing, ...patch };
      return state.agents[key];
    },
  };
}

export function addBig(a, b) {
  return (BigInt(a || "0") + BigInt(b || "0")).toString();
}
