// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/MemoryNFT.sol";
import "../src/ServiceListing.sol";
import "../src/AgentHub.sol";
import "../src/ReputationOracle.sol";
import "../src/Interfaces.sol";

contract MockERC8004Registry {
    mapping(address => bool) public registered;

    function isRegistered(address agent) external view returns (bool) {
        return registered[agent];
    }

    function register(address agent) external {
        registered[agent] = true;
    }
}

contract MockERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    string public name = "Mock USDC";
    string public symbol = "mUSDC";
    uint8 public decimals = 6;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "INSUFFICIENT_BALANCE");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "INSUFFICIENT_BALANCE");
        require(allowance[from][msg.sender] >= amount, "INSUFFICIENT_ALLOWANCE");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        external
    {
        allowance[owner][spender] = value;
    }

    function safeTransferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "INSUFFICIENT_BALANCE");
        require(allowance[from][msg.sender] >= amount, "INSUFFICIENT_ALLOWANCE");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;
        return true;
    }

    function safeTransfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "INSUFFICIENT_BALANCE");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract AgentHubTest is Test {
    MockERC8004Registry erc8004Registry;
    MockERC20 usdc;
    MockERC20 sibylToken;

    MemoryNFT memoryNFT;
    ServiceListing serviceListing;
    AgentHub agentHub;
    ReputationOracle reputationOracle;

    address seller = address(0x1);
    address buyer = address(0x2);
    address feeRecipient = address(0x3);

    function setUp() public {
        erc8004Registry = new MockERC8004Registry();
        usdc = new MockERC20();
        sibylToken = new MockERC20();

        // Register agents
        erc8004Registry.register(seller);
        erc8004Registry.register(buyer);

        // Mint USDC
        usdc.mint(seller, 10000 * 1e6);
        usdc.mint(buyer, 10000 * 1e6);
        usdc.mint(feeRecipient, 10000 * 1e6);

        // Deploy contracts
        memoryNFT = new MemoryNFT(address(erc8004Registry), address(usdc), feeRecipient, 1000);
        serviceListing = new ServiceListing(address(erc8004Registry), address(usdc), feeRecipient, 500);

        agentHub = new AgentHub(
            address(usdc), address(sibylToken), address(memoryNFT), address(serviceListing), address(0), address(0)
        );
        reputationOracle = new ReputationOracle(address(erc8004Registry), address(0), address(0));

        // Authorize agentHub as indexer
        reputationOracle.setIndexerAuthorization(address(agentHub), true);
    }

    // ==================== MemoryNFT Tests ====================

    function testMintMemoryModule() public {
        vm.prank(seller);
        uint256 tokenId = memoryNFT.mintMemoryModule(
            "QmTestCID",
            keccak256("QmTestCID1"),
            1,
            MemoryNFT.MemoryType.ENTITY_FILE,
            "Test Memory",
            "Test Description",
            100 * 1e6
        );

        assertEq(tokenId, 0);
        assertEq(memoryNFT.ownerOf(tokenId), seller);

        (bool valid, string memory schema) = memoryNFT.validateMemory(tokenId);
        assertTrue(valid);
    }

    function testBuyMemoryModule() public {
        vm.prank(seller);
        uint256 tokenId = memoryNFT.mintMemoryModule(
            "QmTestCID",
            keccak256("QmTestCID1"),
            1,
            MemoryNFT.MemoryType.ENTITY_FILE,
            "Test Memory",
            "Test Description",
            100 * 1e6
        );

        vm.prank(buyer);
        usdc.approve(address(memoryNFT), 100 * 1e6);
        memoryNFT.buyMemoryModule(tokenId);

        assertEq(memoryNFT.ownerOf(tokenId), buyer);

        // Check fee went to feeRecipient
        assertEq(usdc.balanceOf(feeRecipient), 10 * 1e6); // 10% fee
        assertEq(usdc.balanceOf(seller), 90 * 1e6); // 90% to seller
    }

    function testDelistMemory() public {
        vm.prank(seller);
        uint256 tokenId = memoryNFT.mintMemoryModule(
            "QmTestCID",
            keccak256("QmTestCID1"),
            1,
            MemoryNFT.MemoryType.ENTITY_FILE,
            "Test Memory",
            "Test Description",
            100 * 1e6
        );

        vm.prank(seller);
        memoryNFT.delistMemory(tokenId);

        (,,,,,,,,,, bool active) = memoryNFT.modules(tokenId);
        assertFalse(active);
    }

    // ==================== ServiceListing Tests ====================

    function testListService() public {
        vm.prank(seller);
        uint256 listingId = serviceListing.listService(
            "Audit Service",
            "Smart contract audit",
            ServiceListing.ServiceCategory.AUDIT,
            200 * 1e6, // Fixed price
            0,
            24
        );

        assertEq(listingId, 0);
        assertEq(serviceListing.totalListings(), 1);

        ServiceListing.Listing memory listing = serviceListing.getListing(listingId);
        assertEq(listing.service.seller, seller);
        assertEq(listing.service.priceUSDC, 200 * 1e6);
        assertTrue(listing.service.active);
    }

    function testPlaceBid() public {
        vm.prank(seller);
        uint256 listingId = serviceListing.listService(
            "Research Service",
            "DeFi research",
            ServiceListing.ServiceCategory.RESEARCH,
            0, // Auction
            50 * 1e6, // Min bid
            48
        );

        vm.prank(buyer);
        usdc.approve(address(serviceListing), 100 * 1e6);
        serviceListing.placeBid(listingId, 100 * 1e6);

        ServiceListing.Listing memory listing = serviceListing.getListing(listingId);
        assertEq(listing.highestBid.bidder, buyer);
        assertEq(listing.highestBid.amountUSDC, 100 * 1e6);
        assertTrue(listing.inEscrow);
    }

    function testBuyNow() public {
        vm.prank(seller);
        uint256 listingId = serviceListing.listService(
            "Debug Service",
            "Code debugging",
            ServiceListing.ServiceCategory.DEBUG,
            150 * 1e6, // Fixed price
            0,
            12
        );

        vm.prank(buyer);
        usdc.approve(address(serviceListing), 150 * 1e6);
        serviceListing.buyNow(listingId);

        ServiceListing.Listing memory listing = serviceListing.getListing(listingId);
        assertEq(listing.winner, buyer);
        assertTrue(listing.inEscrow);
    }

    function testAcceptBid() public {
        vm.prank(seller);
        uint256 listingId = serviceListing.listService(
            "Strategy Service",
            "Trading strategy",
            ServiceListing.ServiceCategory.STRATEGY,
            0, // Auction
            50 * 1e6,
            48
        );

        vm.prank(buyer);
        usdc.approve(address(serviceListing), 200 * 1e6);
        serviceListing.placeBid(listingId, 200 * 1e6);

        vm.prank(seller);
        serviceListing.acceptBid(listingId);

        ServiceListing.Listing memory listing = serviceListing.getListing(listingId);
        assertTrue(listing.highestBid.accepted);
        assertEq(listing.winner, buyer);
    }

    // ==================== AgentHub Tests ====================

    function testCollectMemoryFee() public {
        vm.prank(seller);
        uint256 tokenId = memoryNFT.mintMemoryModule(
            "QmTestCID",
            keccak256("QmTestCID1"),
            1,
            MemoryNFT.MemoryType.ENTITY_FILE,
            "Test Memory",
            "Test Description",
            100 * 1e6
        );

        vm.prank(buyer);
        usdc.approve(address(memoryNFT), 100 * 1e6);
        memoryNFT.buyMemoryModule(tokenId);

        // Fee collected by agentHub
        (uint256 totalVolume, uint256 totalFees,,,) = agentHub.getProtocolStats();
        assertEq(totalVolume, 100 * 1e6);
        assertEq(totalFees, 10 * 1e6);
    }

    function testUpdateFees() public {
        vm.prank(address(agentHub.owner()));
        agentHub.updateFees(1500, 800);

        assertEq(agentHub.MEMORY_FEE_BPS(), 1500);
        assertEq(agentHub.SERVICE_FEE_BPS(), 800);
    }

    function testPause() public {
        vm.prank(address(agentHub.owner()));
        agentHub.setPaused(true);

        assertTrue(agentHub.paused());
    }

    // ==================== ReputationOracle Tests ====================

    function testComputeScore_NotRegistered() public {
        address unregistered = address(0x3);
        vm.expectRevert("NOT_REGISTERED");
        reputationOracle.computeScore(unregistered);
    }

    function testComputeScore_Registered() public {
        // Can't fully test without mock Ping/Reputation
        // Just verify it doesn't revert for registered
        reputationOracle.updateX402Revenue(seller, 5000 * 1e6);
        reputationOracle.updateTalosPnl(seller, 1000 * 1e6);
        reputationOracle.updateMemoryQuality(seller, 956); // 95.6%

        (uint256 score, uint8 tier) = reputationOracle.computeScore(seller);

        assertGt(score, 0);
        assertLe(tier, 4);
    }

    function testBatchUpdateOffChainData() public {
        address[] memory agents = new address[](2);
        agents[0] = seller;
        agents[1] = buyer;

        uint256[] memory x402Rev = new uint256[](2);
        x402Rev[0] = 1000 * 1e6;
        x402Rev[1] = 2000 * 1e6;

        int256[] memory pnl = new int256[](2);
        pnl[0] = 500 * 1e6;
        pnl[1] = -100 * 1e6;

        uint256[] memory quality = new uint256[](2);
        quality[0] = 950;
        quality[1] = 800;

        vm.prank(address(agentHub));
        reputationOracle.batchUpdateOffChainData(agents, x402Rev, pnl, quality);

        assertEq(reputationOracle.x402Revenue30d(seller), 1000 * 1e6);
        assertEq(reputationOracle.talosPnl30d(seller), 500 * 1e6);
        assertEq(reputationOracle.memoryQualityScore(seller), 950);
    }
}
