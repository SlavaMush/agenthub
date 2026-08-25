// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "forge-std/console.sol";
import "./Interfaces.sol";

contract MemoryNFT is ERC721, ERC721URIStorage, Ownable {
    using SafeERC20 for IERC20;

    // Simple counter instead of Counters (removed in OpenZeppelin v5)
    uint256 private _nextTokenId;

    // Configuration
    address public immutable ERC8004_REGISTRY;
    address public immutable USDC;
    address public FEE_RECIPIENT;
    uint256 public FEE_BPS; // 10% = 1000 bps

    // Memory Module metadata
    enum MemoryType {
        ENTITY_FILE,
        SESSION_BRIDGE,
        PRIORITY_INDEX
    }

    struct MemoryModule {
        string cid; // IPFS CID of Sibyl Memory directory
        bytes32 validationHash; // keccak256(cid + schema_version)
        uint8 schemaVersion; // 1 = current
        MemoryType moduleType; // Type of memory module
        string title;
        string description;
        uint256 priceUSDC; // Price in USDC (6 decimals)
        address seller; // ERC-8004 verified agent
        uint256 listedAt;
        bool sold;
        bool active;
    }

    mapping(uint256 => MemoryModule) public modules;
    mapping(address => uint256[]) public sellerTokens;

    event MemoryListed(uint256 indexed tokenId, address indexed seller, uint256 priceUSDC, MemoryType moduleType);
    event MemorySold(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 priceUSDC);
    event MemoryDelisted(uint256 indexed tokenId, address indexed seller);
    event FeeUpdated(uint256 newFeeBps);

    constructor(address _erc8004Registry, address _usdc, address _feeRecipient, uint256 _feeBps)
        ERC721("AgentHub Memory", "AHM")
        Ownable(msg.sender)
    {
        ERC8004_REGISTRY = _erc8004Registry;
        USDC = _usdc;
        FEE_RECIPIENT = _feeRecipient;
        FEE_BPS = _feeBps;
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // ==================== MINTING (SELLER) ====================

    function mintMemoryModule(
        string calldata cid,
        bytes32 validationHash,
        uint8 schemaVersion,
        MemoryType moduleType,
        string calldata title,
        string calldata description,
        uint256 priceUSDC
    ) external returns (uint256) {
        require(IERC8004IdentityRegistry(ERC8004_REGISTRY).isRegistered(msg.sender), "NOT_REGISTERED");
        require(bytes(cid).length > 0, "EMPTY_CID");
        require(priceUSDC > 0, "ZERO_PRICE");
        require(schemaVersion == 1, "INVALID_SCHEMA_VERSION");

        uint256 tokenId = _nextTokenId++;

        modules[tokenId] = MemoryModule({
            cid: cid,
            validationHash: validationHash,
            schemaVersion: schemaVersion,
            moduleType: moduleType,
            title: title,
            description: description,
            priceUSDC: priceUSDC,
            seller: msg.sender,
            listedAt: block.timestamp,
            sold: false,
            active: true
        });

        sellerTokens[msg.sender].push(tokenId);
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, _buildTokenURI(cid, title, description, moduleType));

        emit MemoryListed(tokenId, msg.sender, priceUSDC, moduleType);
        return tokenId;
    }

    // ==================== BUYING (BUYER) ====================

    function buyMemoryModule(uint256 tokenId) external {
        MemoryModule storage module = modules[tokenId];
        require(module.active, "NOT_ACTIVE");
        require(!module.sold, "ALREADY_SOLD");
        require(module.seller != msg.sender, "CANT_BUY_OWN");

        // Transfer USDC from buyer to seller (minus fee)
        uint256 fee = (module.priceUSDC * FEE_BPS) / 10000;
        uint256 sellerAmount = module.priceUSDC - fee;

        IERC20(USDC).safeTransferFrom(msg.sender, FEE_RECIPIENT, fee);
        IERC20(USDC).safeTransferFrom(msg.sender, module.seller, sellerAmount);

        module.sold = true;
        module.active = false;
        _transfer(module.seller, msg.sender, tokenId);

        emit MemorySold(tokenId, msg.sender, module.seller, module.priceUSDC);
    }

    // ==================== BUYING WITH PERMIT (GASLESS) ====================

    function buyMemoryModuleWithPermit(uint256 tokenId, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external {
        MemoryModule storage module = modules[tokenId];
        require(module.active, "NOT_ACTIVE");
        require(!module.sold, "ALREADY_SOLD");
        require(module.seller != msg.sender, "CANT_BUY_OWN");

        uint256 fee = (module.priceUSDC * FEE_BPS) / 10000;
        uint256 sellerAmount = module.priceUSDC - fee;

        // Permit allows gasless USDC approval
        IERC20Permit(USDC).permit(msg.sender, address(this), module.priceUSDC, deadline, v, r, s);
        IERC20(USDC).safeTransferFrom(msg.sender, FEE_RECIPIENT, fee);
        IERC20(USDC).safeTransferFrom(msg.sender, module.seller, sellerAmount);

        module.sold = true;
        module.active = false;
        _transfer(module.seller, msg.sender, tokenId);

        emit MemorySold(tokenId, msg.sender, module.seller, module.priceUSDC);
    }

    // ==================== SELLER MANAGEMENT ====================

    function delistMemory(uint256 tokenId) external {
        MemoryModule storage module = modules[tokenId];
        require(module.seller == msg.sender, "NOT_SELLER");
        require(module.active, "NOT_ACTIVE");
        require(!module.sold, "ALREADY_SOLD");

        module.active = false;
        emit MemoryDelisted(tokenId, msg.sender);
    }

    function updatePrice(uint256 tokenId, uint256 newPriceUSDC) external {
        MemoryModule storage module = modules[tokenId];
        require(module.seller == msg.sender, "NOT_SELLER");
        require(module.active, "NOT_ACTIVE");
        require(!module.sold, "ALREADY_SOLD");
        require(newPriceUSDC > 0, "ZERO_PRICE");

        module.priceUSDC = newPriceUSDC;
        _setTokenURI(tokenId, _buildTokenURI(module.cid, module.title, module.description, module.moduleType));
    }

    // ==================== VALIDATION (FRONTEND) ====================

    function validateMemory(uint256 tokenId) external view returns (bool valid, string memory schema) {
        MemoryModule storage module = modules[tokenId];
        require(module.active || module.sold, "NOT_EXIST");

        // Return schema info for frontend preview
        string memory moduleTypeStr;
        if (module.moduleType == MemoryType.ENTITY_FILE) {
            moduleTypeStr = "EntityFile";
        } else if (module.moduleType == MemoryType.SESSION_BRIDGE) {
            moduleTypeStr = "SessionBridge";
        } else {
            moduleTypeStr = "PriorityIndex";
        }

        schema = string(
            abi.encodePacked('{"type":"', moduleTypeStr, '","schemaVersion":', uint2str(module.schemaVersion), "}")
        );
        return (true, schema);
    }

    // ==================== ADMIN ====================

    function updateFeeBps(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= 2000, "FEE_TOO_HIGH"); // Max 20%
        FEE_BPS = newFeeBps;
        emit FeeUpdated(newFeeBps);
    }

    function updateFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "ZERO_ADDRESS");
        FEE_RECIPIENT = newRecipient;
    }

    // ==================== HELPERS ====================

    function _buildTokenURI(string memory cid, string memory title, string memory description, MemoryType moduleType)
        internal
        pure
        returns (string memory)
    {
        string memory typeStr;
        if (moduleType == MemoryType.ENTITY_FILE) typeStr = "EntityFile";
        else if (moduleType == MemoryType.SESSION_BRIDGE) typeStr = "SessionBridge";
        else typeStr = "PriorityIndex";

        return string(
            abi.encodePacked(
                '{"name":"', title, '","description":"', description, '","type":"', typeStr, '","cid":"', cid, '"}'
            )
        );
    }

    function _baseURI() internal view override returns (string memory) {
        return ""; // We use full URIs in _setTokenURI
    }

    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function getSellerTokens(address seller) external view returns (uint256[] memory) {
        return sellerTokens[seller];
    }

    // Helper to convert uint to string
    function uint2str(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
