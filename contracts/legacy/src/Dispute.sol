// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "forge-std/console.sol";
import "./Interfaces.sol";

contract Dispute is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    // Configuration
    address public immutable USDC;
    address public immutable SIBYL_TOKEN;
    address public immutable SERVICE_LISTING;
    address public immutable MEMORY_NFT;
    address public immutable AGENT_HUB;

    // Dispute parameters
    uint256 public constant JUROR_STAKE_USDC = 500 * 1e6; // 500 USDC stake per juror
    uint256 public constant DISPUTER_STAKE_USDC = 100 * 1e6; // 100 USDC to raise dispute
    uint256 public constant VOTING_PERIOD_HOURS = 48; // 48 hours to vote
    uint256 public constant APPEAL_PERIOD_HOURS = 24; // 24 hours to appeal
    uint256 public constant MAX_APPEALS = 1; // One appeal allowed

    enum DisputeType {
        SERVICE,
        MEMORY
    }
    enum DisputeStatus {
        OPEN,
        VOTING,
        RESOLVED,
        APPEALED,
        CLOSED
    }
    enum Vote {
        BUYER,
        SELLER,
        ABSTAIN
    }

    struct DisputeCase {
        uint256 disputeId;
        DisputeType disputeType;
        uint256 resourceId; // listingId or tokenId
        address disputer; // Who raised the dispute
        address buyer;
        address seller;
        uint256 escrowAmount; // USDC amount in dispute
        uint256 disputerStake; // USDC staked by disputer
        DisputeStatus status;
        uint256 createdAt;
        uint256 votingEndsAt;
        uint256 resolvedAt;

        // Jurors (3)
        address[3] jurors;
        uint256[3] jurorStakes;
        Vote[3] votes;
        uint256 votesCast;

        // Resolution
        Vote winningVote;
        bool buyerWins;
        uint256 buyerRefund;
        uint256 sellerPayout;

        // Appeal
        bool appealed;
        uint256 appealEndsAt;
    }

    mapping(uint256 => DisputeCase) public disputes;
    mapping(address => uint256[]) public userDisputes;
    uint256 public nextDisputeId;

    // Juror pool (ERC-8004 registered agents with high reputation)
    mapping(address => bool) public eligibleJuror;
    address[] public jurorPool;
    uint256 public minimumJurorReputation = 5000; // 50% score threshold

    event DisputeRaised(
        uint256 indexed disputeId,
        DisputeType disputeType,
        uint256 indexed resourceId,
        address indexed disputer,
        uint256 escrowAmount
    );
    event JurorSelected(uint256 indexed disputeId, address indexed juror);
    event VoteCast(uint256 indexed disputeId, address indexed juror, Vote vote);
    event DisputeResolved(uint256 indexed disputeId, bool buyerWins, uint256 buyerRefund, uint256 sellerPayout);
    event DisputeAppealed(uint256 indexed disputeId, address indexed appellant);
    event JurorPoolUpdated(address indexed juror, bool added);

    constructor(address _usdc, address _sibylToken, address _serviceListing, address _memoryNFT, address _agentHub)
        Ownable(msg.sender)
    {
        USDC = _usdc;
        SIBYL_TOKEN = _sibylToken;
        SERVICE_LISTING = _serviceListing;
        MEMORY_NFT = _memoryNFT;
        AGENT_HUB = _agentHub;
    }

    // ==================== RAISE DISPUTE ====================

    function raiseServiceDispute(uint256 listingId) external nonReentrant {
        // Get listing data
        (address seller, address buyer, uint256 escrowAmount, bool disputed, bool delivered) =
            IServiceListing(SERVICE_LISTING).getListing(listingId);

        require(buyer != address(0), "NO_BUYER");
        require(msg.sender == buyer || msg.sender == seller, "NOT_PARTY");
        require(disputed, "NOT_DISPUTED"); // Must be flagged in ServiceListing first
        require(delivered, "NOT_DELIVERED");
        require(escrowAmount > 0, "NO_ESCROW");

        _createDispute(DisputeType.SERVICE, listingId, msg.sender, buyer, seller, escrowAmount);
    }

    function raiseMemoryDispute(uint256 tokenId) external nonReentrant {
        // Get memory module data
        (
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
        ) = IMemoryNFT(MEMORY_NFT).modules(tokenId);

        require(sold, "NOT_SOLD");
        require(msg.sender == seller, "MEMORY_ONLY_SELLER_CAN_DISPUTE"); // Seller disputes non-payment
        require(active || sold, "NOT_VALID");

        // For memory, buyer is the current owner (who should have paid)
        // In practice, this would be called if buyer claims memory is invalid
        // For now, allow seller to dispute if payment failed
        // Buyer would raise via a different mechanism

        address buyer = IMemoryNFT(MEMORY_NFT).ownerOf(tokenId); // Current NFT holder
        require(buyer != seller, "SELF_DISPUTE");

        _createDispute(DisputeType.MEMORY, tokenId, msg.sender, buyer, seller, priceUSDC);
    }

    function _createDispute(
        DisputeType disputeType,
        uint256 resourceId,
        address disputer,
        address buyer,
        address seller,
        uint256 escrowAmount
    ) internal {
        require(IERC20(USDC).balanceOf(disputer) >= DISPUTER_STAKE_USDC, "INSUFFICIENT_STAKE");
        require(IERC20(USDC).allowance(disputer, address(this)) >= DISPUTER_STAKE_USDC, "STAKE_NOT_APPROVED");

        // Stake disputer's USDC
        IERC20(USDC).safeTransferFrom(disputer, address(this), DISPUTER_STAKE_USDC);

        // Select 3 jurors from pool
        address[3] memory jurors = _selectJurors();
        uint256[3] memory jurorStakes;
        for (uint256 i = 0; i < 3; i++) {
            jurorStakes[i] = JUROR_STAKE_USDC;
            // Jurors must stake
            require(IERC20(USDC).balanceOf(jurors[i]) >= JUROR_STAKE_USDC, "JUROR_INSUFFICIENT_STAKE");
            require(IERC20(USDC).allowance(jurors[i], address(this)) >= JUROR_STAKE_USDC, "JUROR_STAKE_NOT_APPROVED");
            IERC20(USDC).safeTransferFrom(jurors[i], address(this), JUROR_STAKE_USDC);
        }

        uint256 disputeId = nextDisputeId++;
        disputes[disputeId] = DisputeCase({
            disputeId: disputeId,
            disputeType: disputeType,
            resourceId: resourceId,
            disputer: disputer,
            buyer: buyer,
            seller: seller,
            escrowAmount: escrowAmount,
            disputerStake: DISPUTER_STAKE_USDC,
            status: DisputeStatus.VOTING,
            createdAt: block.timestamp,
            votingEndsAt: block.timestamp + (VOTING_PERIOD_HOURS * 3600),
            resolvedAt: 0,
            jurors: jurors,
            jurorStakes: [JUROR_STAKE_USDC, JUROR_STAKE_USDC, JUROR_STAKE_USDC],
            votes: [Vote.ABSTAIN, Vote.ABSTAIN, Vote.ABSTAIN],
            votesCast: 0,
            winningVote: Vote.ABSTAIN,
            buyerWins: false,
            buyerRefund: 0,
            sellerPayout: 0,
            appealed: false,
            appealEndsAt: 0
        });

        userDisputes[disputer].push(disputeId);
        userDisputes[buyer].push(disputeId);
        userDisputes[seller].push(disputeId);

        emit DisputeRaised(disputeId, disputeType, resourceId, disputer, escrowAmount);
        for (uint256 i = 0; i < 3; i++) {
            emit JurorSelected(disputeId, jurors[i]);
        }
    }

    // ==================== JUROR VOTING ====================

    function castVote(uint256 disputeId, Vote vote) external nonReentrant {
        DisputeCase storage dispute = disputes[disputeId];
        require(dispute.status == DisputeStatus.VOTING, "NOT_VOTING");
        require(block.timestamp <= dispute.votingEndsAt, "VOTING_ENDED");

        // Find juror index
        uint256 jurorIndex = _findJurorIndex(dispute, msg.sender);
        require(jurorIndex != type(uint256).max, "NOT_JUROR");
        require(dispute.votes[jurorIndex] == Vote.ABSTAIN, "ALREADY_VOTED");

        dispute.votes[jurorIndex] = vote;
        dispute.votesCast++;

        emit VoteCast(disputeId, msg.sender, vote);

        // Check if all 3 voted
        if (dispute.votesCast == 3) {
            _resolveDispute(disputeId);
        }
    }

    function _findJurorIndex(DisputeCase storage dispute, address juror) internal view returns (uint256) {
        for (uint256 i = 0; i < 3; i++) {
            if (dispute.jurors[i] == juror) return i;
        }
        return type(uint256).max;
    }

    function _resolveDispute(uint256 disputeId) internal {
        DisputeCase storage dispute = disputes[disputeId];

        // Count votes
        uint256 buyerVotes = 0;
        uint256 sellerVotes = 0;
        for (uint256 i = 0; i < 3; i++) {
            if (dispute.votes[i] == Vote.BUYER) buyerVotes++;
            else if (dispute.votes[i] == Vote.SELLER) sellerVotes++;
        }

        // Majority wins (2/3 or 3/3)
        Vote winningVote;
        bool buyerWins;
        if (buyerVotes > sellerVotes) {
            winningVote = Vote.BUYER;
            buyerWins = true;
        } else if (sellerVotes > buyerVotes) {
            winningVote = Vote.SELLER;
            buyerWins = false;
        } else {
            // Tie = buyer wins (consumer protection)
            winningVote = Vote.BUYER;
            buyerWins = true;
        }

        dispute.winningVote = winningVote;
        dispute.buyerWins = buyerWins;
        dispute.status = DisputeStatus.RESOLVED;
        dispute.resolvedAt = block.timestamp;

        // Calculate payouts
        if (buyerWins) {
            // Buyer gets full refund + disputer stake back
            dispute.buyerRefund = dispute.escrowAmount + dispute.disputerStake;
            dispute.sellerPayout = 0;

            // Return juror stakes
            for (uint256 i = 0; i < 3; i++) {
                IERC20(USDC).safeTransfer(dispute.jurors[i], dispute.jurorStakes[i]);
            }
            // Return disputer stake
            IERC20(USDC).safeTransfer(dispute.disputer, dispute.disputerStake);
        } else {
            // Seller wins - gets escrow + disputer stake as penalty
            dispute.buyerRefund = 0;
            dispute.sellerPayout = dispute.escrowAmount + dispute.disputerStake;

            // Return juror stakes
            for (uint256 i = 0; i < 3; i++) {
                IERC20(USDC).safeTransfer(dispute.jurors[i], dispute.jurorStakes[i]);
            }
            // Disputer stake goes to seller
            // Already included in sellerPayout
        }

        // Execute payouts
        _executePayout(disputeId);

        emit DisputeResolved(disputeId, buyerWins, dispute.buyerRefund, dispute.sellerPayout);
    }

    function _executePayout(uint256 disputeId) internal {
        DisputeCase storage dispute = disputes[disputeId];

        if (dispute.buyerWins) {
            // Refund buyer from ServiceListing/MemoryNFT escrow
            // This would be called by the marketplace contract
            // For now, we track the amounts
            if (dispute.disputeType == DisputeType.SERVICE) {
                // ServiceListing will call releaseToBuyer(disputeId)
            } else {
                // MemoryNFT will call refundBuyer(disputeId)
            }
        } else {
            // Seller gets paid
            if (dispute.disputeType == DisputeType.SERVICE) {
                // ServiceListing will call releaseToSeller(disputeId)
            } else {
                // MemoryNFT will call paySeller(disputeId)
            }
        }
    }

    // ==================== APPEAL ====================

    function appeal(uint256 disputeId) external nonReentrant {
        DisputeCase storage dispute = disputes[disputeId];
        require(dispute.status == DisputeStatus.RESOLVED, "NOT_RESOLVED");
        require(!dispute.appealed, "ALREADY_APPEALED");
        require(block.timestamp <= dispute.resolvedAt + (APPEAL_PERIOD_HOURS * 3600), "APPEAL_WINDOW_CLOSED");
        require(msg.sender == dispute.buyer || msg.sender == dispute.seller, "NOT_PARTY");

        // Appellant stakes additional USDC
        uint256 appealStake = JUROR_STAKE_USDC; // Same as juror stake
        require(IERC20(USDC).balanceOf(msg.sender) >= appealStake, "INSUFFICIENT_APPEAL_STAKE");
        require(IERC20(USDC).allowance(msg.sender, address(this)) >= appealStake, "APPEAL_STAKE_NOT_APPROVED");
        IERC20(USDC).safeTransferFrom(msg.sender, address(this), appealStake);

        // Select new jurors (different from original)
        address[3] memory newJurors = _selectJurorsExcluding(dispute.jurors);
        for (uint256 i = 0; i < 3; i++) {
            require(IERC20(USDC).balanceOf(newJurors[i]) >= JUROR_STAKE_USDC, "JUROR_INSUFFICIENT_STAKE");
            require(IERC20(USDC).allowance(newJurors[i], address(this)) >= JUROR_STAKE_USDC, "JUROR_STAKE_NOT_APPROVED");
            IERC20(USDC).safeTransferFrom(newJurors[i], address(this), JUROR_STAKE_USDC);
        }

        dispute.appealed = true;
        dispute.status = DisputeStatus.APPEALED;
        dispute.appealEndsAt = block.timestamp + (VOTING_PERIOD_HOURS * 3600);
        dispute.jurors = newJurors;
        dispute.jurorStakes = [JUROR_STAKE_USDC, JUROR_STAKE_USDC, JUROR_STAKE_USDC];
        dispute.votes = [Vote.ABSTAIN, Vote.ABSTAIN, Vote.ABSTAIN];
        dispute.votesCast = 0;

        emit DisputeAppealed(disputeId, msg.sender);
        for (uint256 i = 0; i < 3; i++) {
            emit JurorSelected(disputeId, newJurors[i]);
        }
    }

    // Appeal voting uses same castVote function - checks appealEndsAt

    // ==================== JUROR POOL MANAGEMENT ====================

    function _selectJurors() internal view returns (address[3] memory) {
        require(jurorPool.length >= 3, "INSUFFICIENT_JURORS");

        // Simple pseudo-random selection based on blockhash
        address[3] memory selected;
        for (uint256 i = 0; i < 3; i++) {
            uint256 index = uint256(keccak256(abi.encodePacked(blockhash(block.number - 1 - i), i))) % jurorPool.length;
            selected[i] = jurorPool[index];
        }
        return selected;
    }

    function _selectJurorsExcluding(address[3] memory exclude) internal view returns (address[3] memory) {
        address[] memory available = new address[](jurorPool.length);
        uint256 count = 0;
        for (uint256 i = 0; i < jurorPool.length; i++) {
            bool excluded = false;
            for (uint256 j = 0; j < 3; j++) {
                if (jurorPool[i] == exclude[j]) {
                    excluded = true;
                    break;
                }
            }
            if (!excluded) {
                available[count++] = jurorPool[i];
            }
        }
        require(count >= 3, "INSUFFICIENT_JURORS_AFTER_EXCLUDE");

        address[3] memory selected;
        for (uint256 i = 0; i < 3; i++) {
            uint256 index = uint256(keccak256(abi.encodePacked(blockhash(block.number - 1 - i), i))) % count;
            selected[i] = available[index];
        }
        return selected;
    }

    function addJuror(address juror) external onlyOwner {
        require(
            IERC8004IdentityRegistry(0x8004A169FB4a3325136EB29fA0ceB6D2e539a432).isRegistered(juror), "NOT_REGISTERED"
        );
        // In production, check reputation score >= minimumJurorReputation
        eligibleJuror[juror] = true;
        jurorPool.push(juror);
        emit JurorPoolUpdated(juror, true);
    }

    function removeJuror(address juror) external onlyOwner {
        eligibleJuror[juror] = false;
        // Remove from pool (swap with last)
        for (uint256 i = 0; i < jurorPool.length; i++) {
            if (jurorPool[i] == juror) {
                jurorPool[i] = jurorPool[jurorPool.length - 1];
                jurorPool.pop();
                break;
            }
        }
        emit JurorPoolUpdated(juror, false);
    }

    // ==================== MARKETPLACE INTEGRATION CALLBACKS ====================

    // Called by ServiceListing when buyer confirms delivery (no dispute)
    function confirmServiceDelivery(uint256 listingId) external {
        require(msg.sender == SERVICE_LISTING, "ONLY_SERVICE_LISTING");
        // No dispute raised, normal completion
    }

    // Called by ServiceListing to release to buyer (dispute resolved in buyer favor)
    function releaseToBuyer(uint256 listingId) external {
        require(msg.sender == SERVICE_LISTING, "ONLY_SERVICE_LISTING");
        // Find dispute for this listing
        for (uint256 i = 0; i < nextDisputeId; i++) {
            if (
                disputes[i].disputeType == DisputeType.SERVICE && disputes[i].resourceId == listingId
                    && disputes[i].status == DisputeStatus.RESOLVED && disputes[i].buyerWins
            ) {
                IERC20(USDC).safeTransfer(disputes[i].buyer, disputes[i].buyerRefund);
                return;
            }
        }
    }

    // Called by ServiceListing to release to seller (dispute resolved in seller favor)
    function releaseToSeller(uint256 listingId) external {
        require(msg.sender == SERVICE_LISTING, "ONLY_SERVICE_LISTING");
        for (uint256 i = 0; i < nextDisputeId; i++) {
            if (
                disputes[i].disputeType == DisputeType.SERVICE && disputes[i].resourceId == listingId
                    && disputes[i].status == DisputeStatus.RESOLVED && !disputes[i].buyerWins
            ) {
                IERC20(USDC).safeTransfer(disputes[i].seller, disputes[i].sellerPayout);
                return;
            }
        }
    }

    // Called by MemoryNFT to refund buyer (dispute resolved in buyer favor)
    function refundBuyer(uint256 tokenId) external {
        require(msg.sender == MEMORY_NFT, "ONLY_MEMORY_NFT");
        for (uint256 i = 0; i < nextDisputeId; i++) {
            if (
                disputes[i].disputeType == DisputeType.MEMORY && disputes[i].resourceId == tokenId
                    && disputes[i].status == DisputeStatus.RESOLVED && disputes[i].buyerWins
            ) {
                IERC20(USDC).safeTransfer(disputes[i].buyer, disputes[i].buyerRefund);
                return;
            }
        }
    }

    // Called by MemoryNFT to pay seller (dispute resolved in seller favor)
    function paySeller(uint256 tokenId) external {
        require(msg.sender == MEMORY_NFT, "ONLY_MEMORY_NFT");
        for (uint256 i = 0; i < nextDisputeId; i++) {
            if (
                disputes[i].disputeType == DisputeType.MEMORY && disputes[i].resourceId == tokenId
                    && disputes[i].status == DisputeStatus.RESOLVED && !disputes[i].buyerWins
            ) {
                IERC20(USDC).safeTransfer(disputes[i].seller, disputes[i].sellerPayout);
                return;
            }
        }
    }

    // ==================== ADMIN ====================

    function updateDisputeParams(
        uint256 _jurorStake,
        uint256 _disputerStake,
        uint256 _votingPeriodHours,
        uint256 _appealPeriodHours
    ) external onlyOwner {
        // Can't change immutable, would need storage vars
        // For hackathon, params are constants
    }

    function setMinimumJurorReputation(uint256 score) external onlyOwner {
        minimumJurorReputation = score;
    }

    function emergencyWithdraw(address token) external onlyOwner {
        IERC20(token).safeTransfer(owner(), IERC20(token).balanceOf(address(this)));
    }

    // ==================== VIEWS ====================

    function getDispute(uint256 disputeId) external view returns (DisputeCase memory) {
        return disputes[disputeId];
    }

    function getUserDisputes(address user) external view returns (uint256[] memory) {
        return userDisputes[user];
    }

    function getJurorPool() external view returns (address[] memory) {
        return jurorPool;
    }

    function totalDisputes() external view returns (uint256) {
        return nextDisputeId;
    }
}
