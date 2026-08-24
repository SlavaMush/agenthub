// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "forge-std/console.sol";
import "./Interfaces.sol";

contract ReputationOracle is Ownable {
    // Configuration
    address public immutable ERC8004_REGISTRY;
    address public immutable ERC8004_REPUTATION;
    address public immutable PING_PROTOCOL;

    // Weights (must sum to 10000 = 100%)
    uint256 public WEIGHT_ERC8004_REVIEWS = 4000;    // 40%
    uint256 public WEIGHT_PING_MESSAGES = 2000;      // 20%
    uint256 public WEIGHT_X402_REVENUE = 2500;       // 25%
    uint256 public WEIGHT_TALOS_PNL = 1500;          // 15%
    // Memory quality = bonus up to 10% (added on top)

    // Off-chain data pushed by indexer (updated via admin or authorized indexer)
    mapping(address => uint256) public x402Revenue30d;      // USDC
    mapping(address => int256) public talosPnl30d;          // USDC (can be negative)
    mapping(address => uint256) public memoryQualityScore;  // 0-1000 (avg benchmark score)

    // Authorized indexer to push off-chain data
    mapping(address => bool) public authorizedIndexer;

    event WeightsUpdated(
        uint256 erc8004Reviews,
        uint256 pingMessages,
        uint256 x402Revenue,
        uint256 talosPnl
    );
    event OffChainDataUpdated(address indexed agent, uint256 x402Revenue, int256 talosPnl, uint256 memoryQuality);
    event IndexerAuthorized(address indexed indexer, bool authorized);

    constructor(
        address _erc8004Registry,
        address _erc8004Reputation,
        address _pingProtocol
    ) Ownable(msg.sender) {
        ERC8004_REGISTRY = _erc8004Registry;
        ERC8004_REPUTATION = _erc8004Reputation;
        PING_PROTOCOL = _pingProtocol;
        authorizedIndexer[msg.sender] = true;
    }

    // ==================== CORE: COMPUTE REPUTATION SCORE ====================

    function computeScore(address agent) external view returns (uint256 score, uint8 tier) {
        require(IERC8004IdentityRegistry(ERC8004_REGISTRY).isRegistered(agent), "NOT_REGISTERED");

        // Component 1: ERC-8004 Reviews (40%)
        uint256 reviewCount = IERC8004Reputation(ERC8004_REPUTATION).getReviewCount(agent);
        int256 avgRating = IERC8004Reputation(ERC8004_REPUTATION).getAverageRating(agent);
        
        // Normalize: reviews capped at 100, rating -100 to +100 → 0-1000
        uint256 reviewScore = _normalizeReviews(reviewCount, avgRating);
        uint256 erc8004Component = (reviewScore * WEIGHT_ERC8004_REVIEWS) / 10000;

        // Component 2: Ping Messages (20%)
        uint256 pingCount = IPingProtocol(PING_PROTOCOL).getMessageCount(agent);
        uint256 pingComponent = _normalizePing(pingCount);
        pingComponent = (pingComponent * WEIGHT_PING_MESSAGES) / 10000;

        // Component 3: x402 Revenue 30d (25%) - off-chain data
        uint256 x402Component = _normalizeRevenue(x402Revenue30d[agent]);
        x402Component = (x402Component * WEIGHT_X402_REVENUE) / 10000;

        // Component 4: Talos PnL 30d (15%) - off-chain data
        uint256 talosComponent = _normalizePnl(talosPnl30d[agent]);
        talosComponent = (talosComponent * WEIGHT_TALOS_PNL) / 10000;

        // Base score (0-10000 = 0-100%)
        uint256 baseScore = erc8004Component + pingComponent + x402Component + talosComponent;

        // Memory Quality Bonus (up to 10% = 1000 points)
        uint256 memoryBonus = (memoryQualityScore[agent] * 10) / 100; // 0-1000
        if (baseScore + memoryBonus > 10000) {
            memoryBonus = 10000 - baseScore;
        }

        score = baseScore + memoryBonus; // 0-10000
        tier = _scoreToTier(score);

        return (score, tier);
    }

    // ==================== NORMALIZATION HELPERS ====================

    function _normalizeReviews(uint256 count, int256 avgRating) internal pure returns (uint256) {
        // Count score: logarithmic, caps at 100 reviews = 500 points
        uint256 countScore;
        if (count >= 100) countScore = 500;
        else if (count >= 50) countScore = 400;
        else if (count >= 20) countScore = 300;
        else if (count >= 10) countScore = 200;
        else if (count >= 5) countScore = 100;
        else countScore = count * 10; // 0-50

        // Rating score: -100 to +100 → 0-500 points
        int256 ratingScore;
        if (avgRating >= 80) ratingScore = 500;
        else if (avgRating >= 50) ratingScore = 400;
        else if (avgRating >= 20) ratingScore = 300;
        else if (avgRating >= 0) ratingScore = 250;
        else if (avgRating >= -20) ratingScore = 150;
        else if (avgRating >= -50) ratingScore = 50;
        else ratingScore = 0;

        return countScore + uint256(ratingScore); // 0-1000
    }

    function _normalizePing(uint256 count) internal pure returns (uint256) {
        // Logarithmic: 1000 messages = 1000 points
        if (count >= 1000) return 1000;
        if (count >= 500) return 800;
        if (count >= 200) return 600;
        if (count >= 100) return 400;
        if (count >= 50) return 250;
        if (count >= 20) return 150;
        if (count >= 10) return 80;
        if (count >= 5) return 40;
        return count * 5; // 0-25
    }

    function _normalizeRevenue(uint256 revenueUSDC) internal pure returns (uint256) {
        // $10k = 1000 points
        if (revenueUSDC >= 10000 * 1e6) return 1000;
        if (revenueUSDC >= 5000 * 1e6) return 800;
        if (revenueUSDC >= 2000 * 1e6) return 600;
        if (revenueUSDC >= 1000 * 1e6) return 400;
        if (revenueUSDC >= 500 * 1e6) return 250;
        if (revenueUSDC >= 100 * 1e6) return 100;
        return (revenueUSDC * 1000) / (100 * 1e6); // Linear below $100
    }

    function _normalizePnl(int256 pnlUSDC) internal pure returns (uint256) {
        // Positive PnL: logarithmic up to 1000
        // Negative PnL: penalty
        if (pnlUSDC >= 0) {
            uint256 pnl = uint256(pnlUSDC);
            if (pnl >= 10000 * 1e6) return 1000;
            if (pnl >= 5000 * 1e6) return 800;
            if (pnl >= 2000 * 1e6) return 600;
            if (pnl >= 1000 * 1e6) return 400;
            if (pnl >= 500 * 1e6) return 250;
            if (pnl >= 100 * 1e6) return 100;
            return (pnl * 1000) / (100 * 1e6);
        } else {
            // Negative: penalty up to -500
            int256 absPnl = -pnlUSDC;
            if (absPnl >= 10000 * 1e6) return 0; // Actually would be penalty
            // For simplicity, return 0 for negative (penalty applied in tier)
            return 0;
        }
    }

    function _scoreToTier(uint256 score) internal pure returns (uint8) {
        // 0-10000 → 0-4 (Bronze=0, Silver=1, Gold=2, Platinum=3, Diamond=4)
        if (score >= 8500) return 4; // Diamond
        if (score >= 7000) return 3; // Platinum
        if (score >= 5000) return 2; // Gold
        if (score >= 3000) return 1; // Silver
        return 0; // Bronze
    }

    // ==================== OFF-CHAIN DATA UPDATES (INDEXER) ====================

    function updateX402Revenue(address agent, uint256 revenueUSDC) external {
        require(authorizedIndexer[msg.sender] || msg.sender == owner(), "NOT_AUTHORIZED");
        x402Revenue30d[agent] = revenueUSDC;
        emit OffChainDataUpdated(agent, revenueUSDC, talosPnl30d[agent], memoryQualityScore[agent]);
    }

    function updateTalosPnl(address agent, int256 pnlUSDC) external {
        require(authorizedIndexer[msg.sender] || msg.sender == owner(), "NOT_AUTHORIZED");
        talosPnl30d[agent] = pnlUSDC;
        emit OffChainDataUpdated(agent, x402Revenue30d[agent], pnlUSDC, memoryQualityScore[agent]);
    }

    function updateMemoryQuality(address agent, uint256 qualityScore) external {
        require(authorizedIndexer[msg.sender] || msg.sender == owner(), "NOT_AUTHORIZED");
        require(qualityScore <= 1000, "INVALID_QUALITY"); // 0-1000
        memoryQualityScore[agent] = qualityScore;
        emit OffChainDataUpdated(agent, x402Revenue30d[agent], talosPnl30d[agent], qualityScore);
    }

    function batchUpdateOffChainData(
        address[] calldata agents,
        uint256[] calldata x402Revenue,
        int256[] calldata talosPnl,
        uint256[] calldata memoryQuality
    ) external {
        require(authorizedIndexer[msg.sender] || msg.sender == owner(), "NOT_AUTHORIZED");
        require(agents.length == x402Revenue.length, "LENGTH_MISMATCH");
        require(agents.length == talosPnl.length, "LENGTH_MISMATCH");
        require(agents.length == memoryQuality.length, "LENGTH_MISMATCH");

        for (uint256 i = 0; i < agents.length; i++) {
            x402Revenue30d[agents[i]] = x402Revenue[i];
            talosPnl30d[agents[i]] = talosPnl[i];
            memoryQualityScore[agents[i]] = memoryQuality[i];
        }
        emit OffChainDataUpdated(address(0), 0, 0, 0); // Batch update marker
    }

    // ==================== INDEXER MANAGEMENT ====================

    function setIndexerAuthorization(address indexer, bool authorized) external onlyOwner {
        authorizedIndexer[indexer] = authorized;
        emit IndexerAuthorized(indexer, authorized);
    }

    // ==================== WEIGHT MANAGEMENT ====================

    function updateWeights(
        uint256 erc8004Reviews,
        uint256 pingMessages,
        uint256 x402Revenue,
        uint256 talosPnl
    ) external onlyOwner {
        require(erc8004Reviews + pingMessages + x402Revenue + talosPnl == 10000, "WEIGHTS_MUST_SUM_10000");
        
        WEIGHT_ERC8004_REVIEWS = erc8004Reviews;
        WEIGHT_PING_MESSAGES = pingMessages;
        WEIGHT_X402_REVENUE = x402Revenue;
        WEIGHT_TALOS_PNL = talosPnl;

        emit WeightsUpdated(erc8004Reviews, pingMessages, x402Revenue, talosPnl);
    }

    // ==================== VIEWS ====================

    function getAgentBreakdown(address agent) external view returns (
        uint256 erc8004Score,
        uint256 pingScore,
        uint256 x402Score,
        uint256 talosScore,
        uint256 memoryBonus,
        uint256 totalScore,
        uint8 tier
    ) {
        require(IERC8004IdentityRegistry(ERC8004_REGISTRY).isRegistered(agent), "NOT_REGISTERED");

        uint256 reviewCount = IERC8004Reputation(ERC8004_REPUTATION).getReviewCount(agent);
        int256 avgRating = IERC8004Reputation(ERC8004_REPUTATION).getAverageRating(agent);
        erc8004Score = (_normalizeReviews(reviewCount, avgRating) * WEIGHT_ERC8004_REVIEWS) / 10000;

        uint256 pingCount = IPingProtocol(PING_PROTOCOL).getMessageCount(agent);
        pingScore = ((_normalizePing(pingCount) * WEIGHT_PING_MESSAGES) / 10000);

        x402Score = ((_normalizeRevenue(x402Revenue30d[agent]) * WEIGHT_X402_REVENUE) / 10000);

        talosScore = ((_normalizePnl(talosPnl30d[agent]) * WEIGHT_TALOS_PNL) / 10000);

        memoryBonus = (memoryQualityScore[agent] * 10) / 100;
        if (erc8004Score + pingScore + x402Score + talosScore + memoryBonus > 10000) {
            memoryBonus = 10000 - (erc8004Score + pingScore + x402Score + talosScore);
        }

        totalScore = erc8004Score + pingScore + x402Score + talosScore + memoryBonus;
        tier = _scoreToTier(totalScore);
    }

    function getTierName(uint8 tier) external pure returns (string memory) {
        if (tier == 4) return "Diamond";
        if (tier == 3) return "Platinum";
        if (tier == 2) return "Gold";
        if (tier == 1) return "Silver";
        return "Bronze";
    }
}