// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "forge-std/console.sol";
import "./Interfaces.sol";

contract AgentHub is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    address public immutable USDC;
    address public immutable SIBYL_STAKING;
    address public MEMORY_NFT;
    address public SERVICE_LISTING;
    address public REPUTATION_ORACLE;
    address public DISPUTE;

    // Fee configuration (basis points)
    uint256 public MEMORY_FEE_BPS = 1000;  // 10%
    uint256 public SERVICE_FEE_BPS = 500;  // 5%

    // Protocol state
    bool public paused;
    uint256 public totalVolumeUSDC;
    uint256 public totalFeesCollectedUSDC;

    event MemoryFeeCollected(uint256 tokenId, uint256 amountUSDC, uint256 feeUSDC);
    event ServiceFeeCollected(uint256 listingId, uint256 amountUSDC, uint256 feeUSDC);
    event FeesUpdated(uint256 memoryFeeBps, uint256 serviceFeeBps);
    event ProtocolPaused(bool paused);
    event VolumeUpdated(uint256 totalVolume, uint256 totalFees);

    constructor(
        address _usdc,
        address _sibylStaking,
        address _memoryNFT,
        address _serviceListing,
        address _reputationOracle,
        address _dispute
    ) Ownable(msg.sender) {
        USDC = _usdc;
        SIBYL_STAKING = _sibylStaking;
        MEMORY_NFT = _memoryNFT;
        SERVICE_LISTING = _serviceListing;
        REPUTATION_ORACLE = _reputationOracle;
        DISPUTE = _dispute;
    }

    // ==================== FEE COLLECTION (CALLED BY MARKETPLACE CONTRACTS) ====================

    function collectMemoryFee(uint256 tokenId, uint256 priceUSDC) external nonReentrant {
        require(msg.sender == MEMORY_NFT, "ONLY_MEMORY_NFT");
        require(!paused, "PAUSED");

        uint256 fee = (priceUSDC * MEMORY_FEE_BPS) / 10000;
        require(fee > 0, "ZERO_FEE");

        IERC20(USDC).safeTransferFrom(MEMORY_NFT, SIBYL_STAKING, fee);

        totalVolumeUSDC += priceUSDC;
        totalFeesCollectedUSDC += fee;

        emit MemoryFeeCollected(tokenId, priceUSDC, fee);
        emit VolumeUpdated(totalVolumeUSDC, totalFeesCollectedUSDC);
    }

    function collectServiceFee(uint256 listingId, uint256 amountUSDC) external nonReentrant {
        require(msg.sender == SERVICE_LISTING, "ONLY_SERVICE_LISTING");
        require(!paused, "PAUSED");

        uint256 fee = (amountUSDC * SERVICE_FEE_BPS) / 10000;
        require(fee > 0, "ZERO_FEE");

        IERC20(USDC).safeTransferFrom(SERVICE_LISTING, SIBYL_STAKING, fee);

        totalVolumeUSDC += amountUSDC;
        totalFeesCollectedUSDC += fee;

        emit ServiceFeeCollected(listingId, amountUSDC, fee);
        emit VolumeUpdated(totalVolumeUSDC, totalFeesCollectedUSDC);
    }

    // ==================== ADMIN ====================

    function updateFees(uint256 memoryFeeBps, uint256 serviceFeeBps) external onlyOwner {
        require(memoryFeeBps <= 2000, "MEMORY_FEE_TOO_HIGH"); // Max 20%
        require(serviceFeeBps <= 1000, "SERVICE_FEE_TOO_HIGH"); // Max 10%

        MEMORY_FEE_BPS = memoryFeeBps;
        SERVICE_FEE_BPS = serviceFeeBps;

        emit FeesUpdated(memoryFeeBps, serviceFeeBps);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit ProtocolPaused(_paused);
    }

    function updateContracts(
        address _memoryNFT,
        address _serviceListing,
        address _reputationOracle,
        address _dispute
    ) external onlyOwner {
        if (_memoryNFT != address(0)) MEMORY_NFT = _memoryNFT;
        if (_serviceListing != address(0)) SERVICE_LISTING = _serviceListing;
        if (_reputationOracle != address(0)) REPUTATION_ORACLE = _reputationOracle;
        if (_dispute != address(0)) DISPUTE = _dispute;
    }

    // ==================== EMERGENCY ====================

    function emergencyWithdraw(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).safeTransfer(owner(), balance);
        }
    }

    // ==================== VIEWS ====================

    function getProtocolStats() external view returns (
        uint256 totalVolume,
        uint256 totalFees,
        uint256 memoryFeeBps,
        uint256 serviceFeeBps,
        bool isPaused
    ) {
        return (totalVolumeUSDC, totalFeesCollectedUSDC, MEMORY_FEE_BPS, SERVICE_FEE_BPS, paused);
    }
}