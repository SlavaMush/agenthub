// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/MemoryNFT.sol";
import "../src/ServiceListing.sol";
import "../src/AgentHub.sol";
import "../src/ReputationOracle.sol";
import "../src/Dispute.sol";

contract Deploy is Script {
    // Base Sepolia addresses
    address constant ERC8004_REGISTRY = 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432;
    address constant ERC8004_REPUTATION = 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63;
    address constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e; // Base Sepolia USDC
    address constant SIBYL_TOKEN = 0x797f214a2CD64a4963A91Fa21c8C55Ec3EBa4714;
    address constant SIBYL_STAKING = 0x6151AA0689576E8F8D218f4DC7F6A4Ec1533d44d;
    address constant PING_PROTOCOL = 0x0000000000000000000000000000000000000000; // TODO: Add when available

    // Fee configuration
    uint256 constant MEMORY_FEE_BPS = 1000; // 10%
    uint256 constant SERVICE_FEE_BPS = 500; // 5%
    uint256 constant DISPUTER_STAKE_USDC = 100 * 1e6;
    uint256 constant JUROR_STAKE_USDC = 500 * 1e6;

    function run() external {
        vm.startBroadcast();

        // 1. Deploy MemoryNFT
        MemoryNFT memoryNFT = new MemoryNFT(
            ERC8004_REGISTRY,
            USDC,
            SIBYL_STAKING,
            MEMORY_FEE_BPS
        );
        console.log("MemoryNFT deployed at:", address(memoryNFT));

        // 2. Deploy ServiceListing
        ServiceListing serviceListing = new ServiceListing(
            ERC8004_REGISTRY,
            USDC,
            SIBYL_STAKING,
            SERVICE_FEE_BPS
        );
        console.log("ServiceListing deployed at:", address(serviceListing));

        // 3. Deploy ReputationOracle
        ReputationOracle reputationOracle = new ReputationOracle(
            ERC8004_REGISTRY,
            ERC8004_REPUTATION,
            PING_PROTOCOL
        );
        console.log("ReputationOracle deployed at:", address(reputationOracle));

        // 4. Deploy Dispute
        Dispute dispute = new Dispute(
            USDC,
            SIBYL_TOKEN,
            address(serviceListing),
            address(memoryNFT),
            address(0) // AgentHub - will update after deploy
        );
        console.log("Dispute deployed at:", address(dispute));

        // 5. Deploy AgentHub (core)
        AgentHub agentHub = new AgentHub(
            USDC,
            SIBYL_STAKING,
            address(memoryNFT),
            address(serviceListing),
            address(reputationOracle),
            address(dispute)
        );
        console.log("AgentHub deployed at:", address(agentHub));

        // 6. Update Dispute with AgentHub address
        // (Dispute constructor sets AgentHub as immutable, so we'd need to redeploy)
        // For now, we'll note this and update in a separate transaction
        
        // 7. Authorize AgentHub as indexer for ReputationOracle
        reputationOracle.setIndexerAuthorization(address(agentHub), true);

        // 8. Add initial jurors to Dispute (owner can add later)
        // dispute.addJuror(0x...); // Add ERC-8004 registered agents with high reputation

        vm.stopBroadcast();

        // Print summary
        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("MemoryNFT:", address(memoryNFT));
        console.log("ServiceListing:", address(serviceListing));
        console.log("ReputationOracle:", address(reputationOracle));
        console.log("Dispute:", address(dispute));
        console.log("AgentHub:", address(agentHub));
    }
}