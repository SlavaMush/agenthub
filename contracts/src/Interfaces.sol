// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Shared interfaces for AgentHub contracts

interface IERC8004IdentityRegistry {
    function isRegistered(address agent) external view returns (bool);
    function getAgentId(address agent) external view returns (uint256);
}

interface IERC8004Reputation {
    function getReviewCount(address agent) external view returns (uint256);
    function getAverageRating(address agent) external view returns (int256);
    function getReview(address agent, uint256 index) external view returns (
        address reviewer,
        int128 value,
        uint8 valueDecimals,
        string memory tag1,
        string memory tag2,
        string memory endpoint,
        string memory feedbackURI,
        bytes32 feedbackHash,
        uint256 timestamp
    );
}

interface IPingProtocol {
    function getMessageCount(address agent) external view returns (uint256);
    function getInboxCount(address agent) external view returns (uint256);
}

interface IMemoryNFT {
    function modules(uint256 tokenId) external view returns (
        string memory cid,
        bytes32 validationHash,
        uint8 schemaVersion,
        uint8 moduleType,
        string memory title,
        string memory description,
        uint256 priceUSDC,
        address seller,
        uint256 listedAt,
        bool sold,
        bool active
    );
    function ownerOf(uint256 tokenId) external view returns (address);
    function FEE_BPS() external view returns (uint256);
    event MemorySold(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 priceUSDC);
}

interface IServiceListing {
    function getListing(uint256 listingId) external view returns (
        address seller,
        address winner,
        uint256 escrowAmount,
        bool disputed,
        bool delivered
    );
    function FEE_BPS() external view returns (uint256);
    event PaymentReleased(uint256 indexed listingId, address indexed seller, uint256 amountUSDC);
}