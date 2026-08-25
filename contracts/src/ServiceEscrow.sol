// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IAgentHub} from "./interfaces/IAgentHub.sol";
import {IERC3009} from "./interfaces/IERC3009.sol";

/// @notice USDC escrow for agent services. V1 dispute is owner resolve after freeze.
contract ServiceEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status {
        None,
        Listed,
        Funded,
        Delivered,
        Completed,
        Refunded,
        Frozen
    }

    struct Job {
        address seller;
        address buyer;
        uint96 priceUSDC;
        uint64 deadline;
        uint64 deliveredAt;
        Status status;
        string cid;
        string uri;
    }

    IAgentHub public immutable hub;
    uint64 public constant CONFIRM_GRACE = 3 days;

    uint256 public nextId;
    mapping(uint256 => Job) public jobs;

    error Paused();
    error NotAgent();
    error ZeroPrice();
    error EmptyCid();
    error BadDuration();
    error NotSeller();
    error NotBuyer();
    error BadStatus();
    error TooEarly();
    error TooLate();
    error NotParty();
    error NotOwner();

    event ServiceListed(uint256 indexed jobId, address indexed seller, uint96 priceUSDC, uint64 deadline, string uri);
    event ServiceFunded(uint256 indexed jobId, address indexed buyer, uint96 priceUSDC);
    event ServiceDelivered(uint256 indexed jobId, address indexed seller, string cid);
    event ServiceCompleted(uint256 indexed jobId, address indexed seller, uint256 sellerAmount, uint256 feeUSDC);
    event ServiceRefunded(uint256 indexed jobId, address indexed buyer, uint256 amount);
    event ServiceFrozen(uint256 indexed jobId, address indexed by);
    event ServiceResolved(uint256 indexed jobId, bool toSeller);

    constructor(address hub_) {
        hub = IAgentHub(hub_);
    }

    modifier whenLive() {
        if (hub.paused()) revert Paused();
        _;
    }

    function getJob(uint256 jobId) external view returns (Job memory) {
        return jobs[jobId];
    }

    function list(string calldata uri, uint96 priceUSDC, uint32 durationSeconds)
        external
        whenLive
        returns (uint256 jobId)
    {
        if (!hub.isAgent(msg.sender)) revert NotAgent();
        if (priceUSDC == 0) revert ZeroPrice();
        if (durationSeconds < 1 hours || durationSeconds > 30 days) revert BadDuration();

        jobId = nextId++;
        jobs[jobId] = Job({
            seller: msg.sender,
            buyer: address(0),
            priceUSDC: priceUSDC,
            deadline: uint64(block.timestamp + durationSeconds),
            deliveredAt: 0,
            status: Status.Listed,
            cid: "",
            uri: uri
        });
        emit ServiceListed(jobId, msg.sender, priceUSDC, uint64(block.timestamp + durationSeconds), uri);
    }

    function fund(uint256 jobId) external nonReentrant whenLive {
        Job storage job = jobs[jobId];
        _assertFundable(job, msg.sender);
        IERC20(hub.USDC()).safeTransferFrom(msg.sender, address(this), job.priceUSDC);
        _markFunded(jobId, job, msg.sender);
    }

    function fundWithAuthorization(
        uint256 jobId,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant whenLive {
        Job storage job = jobs[jobId];
        _assertFundable(job, msg.sender);
        IERC3009(hub.USDC())
            .receiveWithAuthorization(msg.sender, address(this), job.priceUSDC, validAfter, validBefore, nonce, v, r, s);
        _markFunded(jobId, job, msg.sender);
    }

    function deliver(uint256 jobId, string calldata cid) external {
        Job storage job = jobs[jobId];
        if (job.seller != msg.sender) revert NotSeller();
        if (job.status != Status.Funded) revert BadStatus();
        if (block.timestamp > job.deadline) revert TooLate();
        if (bytes(cid).length == 0) revert EmptyCid();

        job.status = Status.Delivered;
        job.deliveredAt = uint64(block.timestamp);
        job.cid = cid;
        emit ServiceDelivered(jobId, msg.sender, cid);
    }

    function confirm(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        if (job.buyer != msg.sender) revert NotBuyer();
        if (job.status != Status.Delivered) revert BadStatus();
        _payoutSeller(jobId, job);
    }

    function autoRelease(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        if (job.status != Status.Delivered) revert BadStatus();
        if (block.timestamp < job.deliveredAt + CONFIRM_GRACE) revert TooEarly();
        _payoutSeller(jobId, job);
    }

    function timeoutRefund(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        if (job.buyer != msg.sender) revert NotBuyer();
        if (job.status != Status.Funded) revert BadStatus();
        if (block.timestamp <= job.deadline) revert TooEarly();
        job.status = Status.Refunded;
        IERC20(hub.USDC()).safeTransfer(job.buyer, job.priceUSDC);
        emit ServiceRefunded(jobId, job.buyer, job.priceUSDC);
    }

    function freeze(uint256 jobId) external {
        Job storage job = jobs[jobId];
        if (msg.sender != job.buyer && msg.sender != job.seller) revert NotParty();
        if (job.status != Status.Funded && job.status != Status.Delivered) revert BadStatus();
        job.status = Status.Frozen;
        emit ServiceFrozen(jobId, msg.sender);
    }

    function resolve(uint256 jobId, bool toSeller) external nonReentrant {
        if (msg.sender != hub.owner()) revert NotOwner();
        Job storage job = jobs[jobId];
        if (job.status != Status.Frozen) revert BadStatus();
        if (toSeller) {
            _payoutSeller(jobId, job);
        } else {
            job.status = Status.Refunded;
            IERC20(hub.USDC()).safeTransfer(job.buyer, job.priceUSDC);
            emit ServiceRefunded(jobId, job.buyer, job.priceUSDC);
        }
        emit ServiceResolved(jobId, toSeller);
    }

    function _assertFundable(Job storage job, address buyer) internal view {
        if (job.status != Status.Listed) revert BadStatus();
        if (job.seller == buyer) revert NotSeller();
        if (block.timestamp > job.deadline) revert TooLate();
    }

    function _markFunded(uint256 jobId, Job storage job, address buyer) internal {
        job.buyer = buyer;
        job.status = Status.Funded;
        emit ServiceFunded(jobId, buyer, job.priceUSDC);
    }

    function _payoutSeller(uint256 jobId, Job storage job) internal {
        uint256 price = job.priceUSDC;
        uint256 fee = (price * hub.serviceFeeBps()) / 10_000;
        job.status = Status.Completed;

        IERC20 usdc = IERC20(hub.USDC());
        if (fee > 0) usdc.safeTransfer(hub.treasury(), fee);
        usdc.safeTransfer(job.seller, price - fee);
        hub.noteSettlement(price, fee);
        emit ServiceCompleted(jobId, job.seller, price - fee, fee);
    }
}
