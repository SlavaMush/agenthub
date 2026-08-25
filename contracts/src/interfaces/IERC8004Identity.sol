// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice ERC-8004 Identity Registry is an ERC-721. A wallet is an agent if it owns ≥1 token.
interface IERC8004Identity {
    function balanceOf(address owner) external view returns (uint256);
}
