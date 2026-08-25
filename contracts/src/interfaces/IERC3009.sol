// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Circle USDC EIP-3009. `to` must equal msg.sender for receiveWithAuthorization.
interface IERC3009 {
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}
