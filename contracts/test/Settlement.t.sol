// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentHub} from "../src/AgentHub.sol";
import {MemoryMarket} from "../src/MemoryMarket.sol";
import {ServiceEscrow} from "../src/ServiceEscrow.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {MockIdentityRegistry} from "./mocks/MockIdentityRegistry.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract SettlementTest is Test {
    AgentHub internal hub;
    MemoryMarket internal memoryMarket;
    ServiceEscrow internal escrow;
    MockUSDC internal usdc;
    MockIdentityRegistry internal identity;

    address internal owner = makeAddr("owner");
    address internal treasury = makeAddr("treasury");
    address internal seller;
    address internal buyer;
    uint256 internal sellerPk = 0xA11CE;
    uint256 internal buyerPk = 0xB0B;

    uint96 internal constant PRICE = 100e6;

    function setUp() public {
        seller = vm.addr(sellerPk);
        buyer = vm.addr(buyerPk);

        usdc = new MockUSDC();
        identity = new MockIdentityRegistry();

        vm.prank(owner);
        hub = new AgentHub(address(usdc), address(identity), treasury, 1000, 500);

        memoryMarket = new MemoryMarket(address(hub));
        escrow = new ServiceEscrow(address(hub));

        vm.prank(owner);
        hub.setMarkets(address(memoryMarket), address(escrow));

        identity.register(seller);
        usdc.mint(buyer, 1_000e6);
        usdc.mint(seller, 1_000e6);
    }

    function test_hubRejectsUnknownChain() public {
        vm.chainId(1);
        vm.expectRevert(AgentHub.UnsupportedChain.selector);
        new AgentHub(address(usdc), address(identity), treasury, 1000, 500);
    }

    function test_listRequiresAgent() public {
        vm.prank(buyer);
        vm.expectRevert(MemoryMarket.NotAgent.selector);
        memoryMarket.list("bafytest", "ipfs://meta", PRICE);
    }

    function test_buyMemorySplitsFee() public {
        vm.prank(seller);
        uint256 id = memoryMarket.list("bafytest", "ipfs://meta.json", PRICE);

        vm.startPrank(buyer);
        usdc.approve(address(memoryMarket), PRICE);
        memoryMarket.buy(id);
        vm.stopPrank();

        assertEq(memoryMarket.ownerOf(id), buyer);
        assertEq(usdc.balanceOf(treasury), 10e6);
        assertEq(usdc.balanceOf(seller), 1_000e6 + 90e6);
        assertEq(hub.totalVolumeUSDC(), PRICE);
        assertEq(hub.totalFeesUSDC(), 10e6);
        assertFalse(memoryMarket.getListing(id).active);
    }

    function test_buyWithAuthorization() public {
        vm.prank(seller);
        uint256 id = memoryMarket.list("bafytest", "ipfs://meta.json", PRICE);

        uint256 validAfter = 0;
        uint256 validBefore = block.timestamp + 1 hours;
        bytes32 nonce = keccak256("nonce-1");

        (uint8 v, bytes32 r, bytes32 s) =
            _signReceive(buyerPk, buyer, address(memoryMarket), PRICE, validAfter, validBefore, nonce);

        vm.prank(buyer);
        memoryMarket.buyWithAuthorization(id, validAfter, validBefore, nonce, v, r, s);

        assertEq(memoryMarket.ownerOf(id), buyer);
        assertEq(usdc.balanceOf(treasury), 10e6);
    }

    function test_pauseBlocksListAndBuy() public {
        vm.prank(owner);
        hub.setPaused(true);

        vm.prank(seller);
        vm.expectRevert(MemoryMarket.Paused.selector);
        memoryMarket.list("bafy", "ipfs://x", PRICE);
    }

    function test_serviceHappyPath() public {
        vm.prank(seller);
        uint256 jobId = escrow.list("ipfs://job", PRICE, uint32(2 days));

        vm.startPrank(buyer);
        usdc.approve(address(escrow), PRICE);
        escrow.fund(jobId);
        vm.stopPrank();

        vm.prank(seller);
        escrow.deliver(jobId, "bafy-delivery");

        vm.prank(buyer);
        escrow.confirm(jobId);

        assertEq(usdc.balanceOf(treasury), 5e6);
        assertEq(usdc.balanceOf(seller), 1_000e6 + 95e6);
        assertEq(uint256(escrow.getJob(jobId).status), uint256(ServiceEscrow.Status.Completed));
    }

    function test_timeoutRefund() public {
        vm.prank(seller);
        uint256 jobId = escrow.list("ipfs://job", PRICE, uint32(1 hours));

        vm.startPrank(buyer);
        usdc.approve(address(escrow), PRICE);
        escrow.fund(jobId);
        vm.stopPrank();

        vm.warp(block.timestamp + 1 hours + 1);

        vm.prank(buyer);
        escrow.timeoutRefund(jobId);

        assertEq(usdc.balanceOf(buyer), 1_000e6);
        assertEq(uint256(escrow.getJob(jobId).status), uint256(ServiceEscrow.Status.Refunded));
    }

    function test_autoReleaseAfterGrace() public {
        vm.prank(seller);
        uint256 jobId = escrow.list("ipfs://job", PRICE, uint32(2 days));

        vm.startPrank(buyer);
        usdc.approve(address(escrow), PRICE);
        escrow.fund(jobId);
        vm.stopPrank();

        vm.prank(seller);
        escrow.deliver(jobId, "bafy-delivery");

        vm.expectRevert(ServiceEscrow.TooEarly.selector);
        escrow.autoRelease(jobId);

        vm.warp(block.timestamp + 3 days + 1);
        escrow.autoRelease(jobId);

        assertEq(usdc.balanceOf(treasury), 5e6);
        assertEq(usdc.balanceOf(seller), 1_000e6 + 95e6);
    }

    function test_freezeAndResolveToBuyer() public {
        vm.prank(seller);
        uint256 jobId = escrow.list("ipfs://job", PRICE, uint32(2 days));

        vm.startPrank(buyer);
        usdc.approve(address(escrow), PRICE);
        escrow.fund(jobId);
        escrow.freeze(jobId);
        vm.stopPrank();

        vm.prank(owner);
        escrow.resolve(jobId, false);

        assertEq(usdc.balanceOf(buyer), 1_000e6);
        assertEq(usdc.balanceOf(treasury), 0);
    }

    function test_pauseDoesNotTrapEscrow() public {
        vm.prank(seller);
        uint256 jobId = escrow.list("ipfs://job", PRICE, uint32(2 days));

        vm.startPrank(buyer);
        usdc.approve(address(escrow), PRICE);
        escrow.fund(jobId);
        vm.stopPrank();

        vm.prank(seller);
        escrow.deliver(jobId, "bafy");

        vm.prank(owner);
        hub.setPaused(true);

        vm.prank(buyer);
        escrow.confirm(jobId);

        assertEq(usdc.balanceOf(seller), 1_000e6 + 95e6);
    }

    function _signReceive(
        uint256 pk,
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce
    ) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 structHash = keccak256(
            abi.encode(usdc.RECEIVE_WITH_AUTHORIZATION_TYPEHASH(), from, to, value, validAfter, validBefore, nonce)
        );
        bytes32 digest = MessageHashUtils.toTypedDataHash(usdc.DOMAIN_SEPARATOR(), structHash);
        (v, r, s) = vm.sign(pk, digest);
    }
}
