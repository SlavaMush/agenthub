/** Filled after `forge script script/Deploy.s.sol`. Empty means not deployed yet. */

export const DEPLOYMENTS = {
  8453: {
    agentHub: process.env.AGENT_HUB_ADDRESS || "",
    memoryMarket: process.env.MEMORY_MARKET_ADDRESS || "",
    serviceEscrow: process.env.SERVICE_ESCROW_ADDRESS || "",
  },
  84532: {
    agentHub: process.env.AGENT_HUB_ADDRESS || "",
    memoryMarket: process.env.MEMORY_MARKET_ADDRESS || "",
    serviceEscrow: process.env.SERVICE_ESCROW_ADDRESS || "",
  },
};

export function getDeployments(chainId) {
  return DEPLOYMENTS[chainId] || DEPLOYMENTS[84532];
}
