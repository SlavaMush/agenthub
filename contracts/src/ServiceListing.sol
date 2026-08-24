// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "forge-std/console.sol";
import "./Interfaces.sol";

contract ServiceListing is ERC1155, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    // Configuration
    address public immutable ERC8004_REGISTRY;
    address public immutable USDC;
    address public FEE_RECIPIENT;
    uint256 public FEE_BPS; // 5% = 500 bps

    // Service categories
    enum ServiceCategory { AUDIT, RESEARCH, CONTENT, DEBUG, STRATEGY, MEMORY_BUILD }

    struct Service {
        string title;
        string description;
        ServiceCategory category;
        uint256 priceUSDC;        // Fixed price (0 = auction)
        uint256 minBidUSDC;       // Minimum bid for auctions
        uint256 durationHours;    // Expected delivery time
        address seller;
        bool active;
        uint256 createdAt;
    }

    struct Bid {
        address bidder;
        uint256 amountUSDC;
        uint256 timestamp;
        bool accepted;
        bool refunded;
    }

    struct Listing {
        Service service;
        Bid highestBid;
        bool inEscrow;
        address winner;
        uint256 escrowAmount;
        uint256 acceptedAt;
        bool delivered;
        bool disputed;
    }

    mapping(uint256 => Listing) public listings;
    mapping(address => uint256[]) public sellerListings;
    mapping(uint256 => mapping(address => uint256)) public bids; // listingId -> bidder -> amount
    uint256 public nextListingId;

    event ServiceListed(uint256 indexed listingId, address indexed seller, uint256 priceUSDC, ServiceCategory category);
    event BidPlaced(uint256 indexed listingId, address indexed bidder, uint256 amountUSDC);
    event BidAccepted(uint256 indexed listingId, address indexed winner, uint256 amountUSDC);
    event WorkDelivered(uint256 indexed listingId, address indexed seller, string memoryCID);
    event WorkConfirmed(uint256 indexed listingId, address indexed buyer);
    event PaymentReleased(uint256 indexed listingId, address indexed seller, uint256 amountUSDC);
    event ServiceDisputed(uint256 indexed listingId, address indexed disputer);
    event ServiceCancelled(uint256 indexed listingId, address indexed seller);
    event FeeUpdated(uint256 newFeeBps);

    constructor(
        address _erc8004Registry,
        address _usdc,
        address _feeRecipient,
        uint256 _feeBps
    ) ERC1155("") Ownable(msg.sender) {
        ERC8004_REGISTRY = _erc8004Registry;
        USDC = _usdc;
        FEE_RECIPIENT = _feeRecipient;
        FEE_BPS = _feeBps;
    }

    // ==================== LISTING (SELLER) ====================

    function listService(
        string calldata title,
        string calldata description,
        ServiceCategory category,
        uint256 priceUSDC,      // 0 = auction
        uint256 minBidUSDC,     // For auctions
        uint256 durationHours
    ) external returns (uint256) {
        require(IERC8004IdentityRegistry(ERC8004_REGISTRY).isRegistered(msg.sender), "NOT_REGISTERED");
        require(bytes(title).length > 0, "EMPTY_TITLE");
        require(durationHours > 0, "INVALID_DURATION");
        if (priceUSDC == 0) {
            require(minBidUSDC > 0, "MIN_BID_REQUIRED");
        } else {
            require(priceUSDC > 0, "ZERO_PRICE");
        }

        uint256 listingId = nextListingId++;
        
        listings[listingId] = Listing({
            service: Service({
                title: title,
                description: description,
                category: category,
                priceUSDC: priceUSDC,
                minBidUSDC: minBidUSDC,
                durationHours: durationHours,
                seller: msg.sender,
                active: true,
                createdAt: block.timestamp
            }),
            highestBid: Bid({bidder: address(0), amountUSDC: 0, timestamp: 0, accepted: false, refunded: false}),
            inEscrow: false,
            winner: address(0),
            escrowAmount: 0,
            acceptedAt: 0,
            delivered: false,
            disputed: false
        });

        sellerListings[msg.sender].push(listingId);
        _mint(msg.sender, listingId, 1, "");

        emit ServiceListed(listingId, msg.sender, priceUSDC, category);
        return listingId;
    }

    // ==================== BIDDING (BUYER) ====================

    function placeBid(uint256 listingId, uint256 amountUSDC) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.service.active, "NOT_ACTIVE");
        require(listing.service.priceUSDC == 0, "FIXED_PRICE_USE_BUY");
        require(amountUSDC >= listing.service.minBidUSDC, "BELOW_MIN_BID");
        require(amountUSDC > listing.highestBid.amountUSDC, "NOT_HIGHEST");
        require(listing.service.seller != msg.sender, "CANT_BID_OWN");

        // Refund previous highest bidder
        if (listing.highestBid.bidder != address(0)) {
            IERC20(USDC).safeTransfer(listing.highestBid.bidder, listing.highestBid.amountUSDC);
            bids[listingId][listing.highestBid.bidder] = 0;
        }

        // Escrow new bid
        IERC20(USDC).safeTransferFrom(msg.sender, address(this), amountUSDC);
        bids[listingId][msg.sender] = amountUSDC;

        listing.highestBid = Bid({
            bidder: msg.sender,
            amountUSDC: amountUSDC,
            timestamp: block.timestamp,
            accepted: false,
            refunded: false
        });
        listing.inEscrow = true;
        listing.escrowAmount = amountUSDC;

        emit BidPlaced(listingId, msg.sender, amountUSDC);
    }

    function placeBidWithPermit(
        uint256 listingId,
        uint256 amountUSDC,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.service.active, "NOT_ACTIVE");
        require(listing.service.priceUSDC == 0, "FIXED_PRICE_USE_BUY");
        require(amountUSDC >= listing.service.minBidUSDC, "BELOW_MIN_BID");
        require(amountUSDC > listing.highestBid.amountUSDC, "NOT_HIGHEST");
        require(listing.service.seller != msg.sender, "CANT_BID_OWN");

        if (listing.highestBid.bidder != address(0)) {
            IERC20(USDC).safeTransfer(listing.highestBid.bidder, listing.highestBid.amountUSDC);
            bids[listingId][listing.highestBid.bidder] = 0;
        }

        IERC20Permit(USDC).permit(msg.sender, address(this), amountUSDC, deadline, v, r, s);
        IERC20(USDC).safeTransferFrom(msg.sender, address(this), amountUSDC);
        bids[listingId][msg.sender] = amountUSDC;

        listing.highestBid = Bid({
            bidder: msg.sender,
            amountUSDC: amountUSDC,
            timestamp: block.timestamp,
            accepted: false,
            refunded: false
        });
        listing.inEscrow = true;
        listing.escrowAmount = amountUSDC;

        emit BidPlaced(listingId, msg.sender, amountUSDC);
    }

    // ==================== BUY NOW (FIXED PRICE) ====================

    function buyNow(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.service.active, "NOT_ACTIVE");
        require(listing.service.priceUSDC > 0, "AUCTION_USE_BID");
        require(listing.service.seller != msg.sender, "CANT_BUY_OWN");

        IERC20(USDC).safeTransferFrom(msg.sender, address(this), listing.service.priceUSDC);
        
        listing.inEscrow = true;
        listing.escrowAmount = listing.service.priceUSDC;
        listing.winner = msg.sender;
        listing.acceptedAt = block.timestamp;

        emit BidAccepted(listingId, msg.sender, listing.service.priceUSDC);
    }

    function buyNowWithPermit(
        uint256 listingId,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.service.active, "NOT_ACTIVE");
        require(listing.service.priceUSDC > 0, "AUCTION_USE_BID");
        require(listing.service.seller != msg.sender, "CANT_BUY_OWN");

        IERC20Permit(USDC).permit(msg.sender, address(this), listing.service.priceUSDC, deadline, v, r, s);
        IERC20(USDC).safeTransferFrom(msg.sender, address(this), listing.service.priceUSDC);
        
        listing.inEscrow = true;
        listing.escrowAmount = listing.service.priceUSDC;
        listing.winner = msg.sender;
        listing.acceptedAt = block.timestamp;

        emit BidAccepted(listingId, msg.sender, listing.service.priceUSDC);
    }

    // ==================== SELLER ACTIONS ====================

    function acceptBid(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.service.seller == msg.sender, "NOT_SELLER");
        require(listing.service.active, "NOT_ACTIVE");
        require(listing.service.priceUSDC == 0, "NOT_AUCTION");
        require(listing.highestBid.bidder != address(0), "NO_BIDS");
        require(!listing.highestBid.accepted, "ALREADY_ACCEPTED");

        listing.highestBid.accepted = true;
        listing.winner = listing.highestBid.bidder;
        listing.escrowAmount = listing.highestBid.amountUSDC;
        listing.inEscrow = true;
        listing.acceptedAt = block.timestamp;

        emit BidAccepted(listingId, listing.highestBid.bidder, listing.highestBid.amountUSDC);
    }

    function deliverWork(uint256 listingId, string calldata memoryCID) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.service.seller == msg.sender, "NOT_SELLER");
        require(listing.inEscrow, "NOT_IN_ESCROW");
        require(!listing.delivered, "ALREADY_DELIVERED");
        require(bytes(memoryCID).length > 0, "EMPTY_CID");

        listing.delivered = true;

        emit WorkDelivered(listingId, msg.sender, memoryCID);
    }

    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.service.seller == msg.sender, "NOT_SELLER");
        require(listing.service.active, "NOT_ACTIVE");
        require(!listing.inEscrow, "IN_ESCROW"); // Can't cancel if funds escrowed

        listing.service.active = false;
        _burn(msg.sender, listingId, 1);

        emit ServiceCancelled(listingId, msg.sender);
    }

    // ==================== BUYER ACTIONS ====================

    function confirmDelivery(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.winner == msg.sender, "NOT_WINNER");
        require(listing.delivered, "NOT_DELIVERED");
        require(!listing.disputed, "DISPUTED");

        _releasePayment(listingId);
    }

    function raiseDispute(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.winner == msg.sender || listing.service.seller == msg.sender, "NOT_PARTY");
        require(listing.inEscrow, "NOT_IN_ESCROW");
        require(!listing.disputed, "ALREADY_DISPUTED");
        require(listing.delivered, "NOT_DELIVERED");

        listing.disputed = true;
        // Dispute resolution handled by Dispute.sol contract
        emit ServiceDisputed(listingId, msg.sender);
    }

    // ==================== INTERNAL ====================

    function _releasePayment(uint256 listingId) internal {
        Listing storage listing = listings[listingId];
        
        uint256 fee = (listing.escrowAmount * FEE_BPS) / 10000;
        uint256 sellerAmount = listing.escrowAmount - fee;

        IERC20(USDC).safeTransfer(FEE_RECIPIENT, fee);
        IERC20(USDC).safeTransfer(listing.service.seller, sellerAmount);

        listing.service.active = false;
        listing.inEscrow = false;
        listing.escrowAmount = 0;

        _burn(listing.service.seller, listingId, 1);
        _mint(listing.winner, listingId, 1, "");

        emit PaymentReleased(listingId, listing.service.seller, sellerAmount);
    }

    // ==================== ADMIN ====================

    function updateFeeBps(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= 1000, "FEE_TOO_HIGH"); // Max 10%
        FEE_BPS = newFeeBps;
        emit FeeUpdated(newFeeBps);
    }

    function updateFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "ZERO_ADDRESS");
        FEE_RECIPIENT = newRecipient;
    }

    function emergencyWithdraw(address token) external onlyOwner {
        IERC20(token).safeTransfer(owner(), IERC20(token).balanceOf(address(this)));
    }

    // ==================== VIEWS ====================

    function getListing(uint256 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }

    function getSellerListings(address seller) external view returns (uint256[] memory) {
        return sellerListings[seller];
    }

    function getBid(uint256 listingId, address bidder) external view returns (uint256) {
        return bids[listingId][bidder];
    }

    function totalListings() external view returns (uint256) {
        return nextListingId;
    }
}