// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {AgentHub} from "../src/AgentHub.sol";
import {MemoryMarket} from "../src/MemoryMarket.sol";
import {ServiceEscrow} from "../src/ServiceEscrow.sol";

contract Deploy is Script {
    // Circle native USDC
    address constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    // ERC-8004 Identity Registry (vanity singletons)
    address constant IDENTITY_BASE = 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432;
    address constant IDENTITY_BASE_SEPOLIA = 0x8004A818BFB912233c491871b3d84c89A494BD9e;

    uint16 constant MEMORY_FEE_BPS = 1000;
    uint16 constant SERVICE_FEE_BPS = 500;

    function run() external {
        address usdc;
        address identity;
        if (block.chainid == 8453) {
            usdc = USDC_BASE;
            identity = IDENTITY_BASE;
        } else if (block.chainid == 84532) {
            usdc = USDC_BASE_SEPOLIA;
            identity = IDENTITY_BASE_SEPOLIA;
        } else {
            revert("Deploy only on Base (8453) or Base Sepolia (84532)");
        }

        address treasury = vm.envOr("TREASURY", msg.sender);

        vm.startBroadcast();
        AgentHub hub = new AgentHub(usdc, identity, treasury, MEMORY_FEE_BPS, SERVICE_FEE_BPS);
        MemoryMarket memoryMarket = new MemoryMarket(address(hub));
        ServiceEscrow escrow = new ServiceEscrow(address(hub));
        hub.setMarkets(address(memoryMarket), address(escrow));
        vm.stopBroadcast();

        console2.log("chainId", block.chainid);
        console2.log("USDC", usdc);
        console2.log("IdentityRegistry", identity);
        console2.log("Treasury", treasury);
        console2.log("AgentHub", address(hub));
        console2.log("MemoryMarket", address(memoryMarket));
        console2.log("ServiceEscrow", address(escrow));
    }
}
