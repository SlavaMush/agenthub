// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC8004Identity} from "./interfaces/IERC8004Identity.sol";

/// @notice Protocol registry: pause, fees, treasury, ERC-8004, USDC. Does not custody funds.
contract AgentHub is Ownable {
    uint16 public constant MAX_FEE_BPS = 2000;

    address public immutable USDC;

    address public identityRegistry;
    address public treasury;
    address public memoryMarket;
    address public serviceEscrow;

    uint16 public memoryFeeBps;
    uint16 public serviceFeeBps;
    bool public paused;

    uint256 public totalVolumeUSDC;
    uint256 public totalFeesUSDC;

    error ZeroAddress();
    error FeeTooHigh();
    error NotMarket();
    error UnsupportedChain();

    event IdentityRegistryUpdated(address indexed registry);
    event TreasuryUpdated(address indexed treasury);
    event MarketsUpdated(address indexed memoryMarket, address indexed serviceEscrow);
    event FeesUpdated(uint16 memoryFeeBps, uint16 serviceFeeBps);
    event PauseSet(bool paused);
    event SettlementNoted(address indexed market, uint256 volumeUSDC, uint256 feeUSDC);

    constructor(address usdc, address identityRegistry_, address treasury_, uint16 memoryFeeBps_, uint16 serviceFeeBps_)
        Ownable(msg.sender)
    {
        if (block.chainid != 8453 && block.chainid != 84532 && block.chainid != 31337) {
            revert UnsupportedChain();
        }
        if (usdc == address(0) || identityRegistry_ == address(0) || treasury_ == address(0)) {
            revert ZeroAddress();
        }
        if (memoryFeeBps_ > MAX_FEE_BPS || serviceFeeBps_ > MAX_FEE_BPS) revert FeeTooHigh();

        USDC = usdc;
        identityRegistry = identityRegistry_;
        treasury = treasury_;
        memoryFeeBps = memoryFeeBps_;
        serviceFeeBps = serviceFeeBps_;
    }

    function isAgent(address account) public view returns (bool) {
        return IERC8004Identity(identityRegistry).balanceOf(account) > 0;
    }

    function setIdentityRegistry(address registry) external onlyOwner {
        if (registry == address(0)) revert ZeroAddress();
        identityRegistry = registry;
        emit IdentityRegistryUpdated(registry);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    function setMarkets(address memoryMarket_, address serviceEscrow_) external onlyOwner {
        if (memoryMarket_ == address(0) || serviceEscrow_ == address(0)) revert ZeroAddress();
        memoryMarket = memoryMarket_;
        serviceEscrow = serviceEscrow_;
        emit MarketsUpdated(memoryMarket_, serviceEscrow_);
    }

    function setFees(uint16 memoryFeeBps_, uint16 serviceFeeBps_) external onlyOwner {
        if (memoryFeeBps_ > MAX_FEE_BPS || serviceFeeBps_ > MAX_FEE_BPS) revert FeeTooHigh();
        memoryFeeBps = memoryFeeBps_;
        serviceFeeBps = serviceFeeBps_;
        emit FeesUpdated(memoryFeeBps_, serviceFeeBps_);
    }

    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
        emit PauseSet(paused_);
    }

    function noteSettlement(uint256 volumeUSDC, uint256 feeUSDC) external {
        if (msg.sender != memoryMarket && msg.sender != serviceEscrow) revert NotMarket();
        totalVolumeUSDC += volumeUSDC;
        totalFeesUSDC += feeUSDC;
        emit SettlementNoted(msg.sender, volumeUSDC, feeUSDC);
    }
}
