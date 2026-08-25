// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @notice Minimal ERC-8004-style identity: registered iff balanceOf > 0.
contract MockIdentityRegistry is ERC721 {
    uint256 public nextId = 1;

    constructor() ERC721("AgentIdentity", "AID") {}

    function register(address agent) external returns (uint256 id) {
        id = nextId++;
        _safeMint(agent, id);
    }
}
