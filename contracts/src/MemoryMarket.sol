// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IAgentHub} from "./interfaces/IAgentHub.sol";
import {IERC3009} from "./interfaces/IERC3009.sol";

/// @notice Thin ERC-721 for Sibyl memory CIDs. Metadata lives at tokenURI (ipfs://).
contract MemoryMarket is ERC721, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IAgentHub public immutable hub;

    struct Listing {
        address seller;
        uint96 priceUSDC;
        bytes32 cidHash;
        bool active;
    }

    uint256 public nextId;
    mapping(uint256 => Listing) public listings;
    mapping(uint256 => string) private _uris;
    mapping(uint256 => string) public cids;

    error Paused();
    error NotAgent();
    error EmptyCid();
    error ZeroPrice();
    error NotSeller();
    error Inactive();
    error SelfBuy();
    error BadUri();
    error NotOwner();

    event MemoryListed(uint256 indexed tokenId, address indexed seller, uint96 priceUSDC, bytes32 cidHash, string cid);
    event MemoryDelisted(uint256 indexed tokenId, address indexed seller);
    event MemorySold(
        uint256 indexed tokenId, address indexed buyer, address indexed seller, uint96 priceUSDC, uint256 feeUSDC
    );

    constructor(address hub_) ERC721("AgentHub Memory", "AHMEM") {
        hub = IAgentHub(hub_);
    }

    modifier whenLive() {
        if (hub.paused()) revert Paused();
        _;
    }

    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return listings[tokenId];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _uris[tokenId];
    }

    function list(string calldata cid, string calldata uri, uint96 priceUSDC)
        external
        whenLive
        returns (uint256 tokenId)
    {
        if (!hub.isAgent(msg.sender)) revert NotAgent();
        if (bytes(cid).length == 0) revert EmptyCid();
        if (bytes(uri).length == 0) revert BadUri();
        if (priceUSDC == 0) revert ZeroPrice();

        tokenId = nextId++;
        bytes32 cidHash = keccak256(bytes(cid));
        listings[tokenId] = Listing({seller: msg.sender, priceUSDC: priceUSDC, cidHash: cidHash, active: true});
        cids[tokenId] = cid;
        _uris[tokenId] = uri;
        _safeMint(msg.sender, tokenId);

        emit MemoryListed(tokenId, msg.sender, priceUSDC, cidHash, cid);
    }

    function delist(uint256 tokenId) external {
        Listing storage item = listings[tokenId];
        if (item.seller != msg.sender) revert NotSeller();
        if (!item.active) revert Inactive();
        item.active = false;
        emit MemoryDelisted(tokenId, msg.sender);
    }

    function buy(uint256 tokenId) external nonReentrant whenLive {
        Listing storage item = listings[tokenId];
        _assertBuyable(tokenId, item, msg.sender);
        IERC20(hub.USDC()).safeTransferFrom(msg.sender, address(this), item.priceUSDC);
        _settle(tokenId, item, msg.sender);
    }

    function buyWithAuthorization(
        uint256 tokenId,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant whenLive {
        Listing storage item = listings[tokenId];
        _assertBuyable(tokenId, item, msg.sender);
        IERC3009(hub.USDC())
            .receiveWithAuthorization(
                msg.sender, address(this), item.priceUSDC, validAfter, validBefore, nonce, v, r, s
            );
        _settle(tokenId, item, msg.sender);
    }

    function _assertBuyable(uint256 tokenId, Listing storage item, address buyer) internal view {
        if (!item.active) revert Inactive();
        if (item.seller == buyer) revert SelfBuy();
        if (ownerOf(tokenId) != item.seller) revert NotOwner();
    }

    function _settle(uint256 tokenId, Listing storage item, address buyer) internal {
        address seller = item.seller;
        uint256 price = item.priceUSDC;
        uint256 fee = (price * hub.memoryFeeBps()) / 10_000;

        item.active = false;

        IERC20 usdc = IERC20(hub.USDC());
        if (fee > 0) usdc.safeTransfer(hub.treasury(), fee);
        usdc.safeTransfer(seller, price - fee);
        _transfer(seller, buyer, tokenId);

        hub.noteSettlement(price, fee);
        emit MemorySold(tokenId, buyer, seller, uint96(price), fee);
    }
}
