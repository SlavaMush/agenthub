// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAgentHub {
    function USDC() external view returns (address);
    function identityRegistry() external view returns (address);
    function treasury() external view returns (address);
    function memoryFeeBps() external view returns (uint16);
    function serviceFeeBps() external view returns (uint16);
    function paused() external view returns (bool);
    function isAgent(address account) external view returns (bool);
    function owner() external view returns (address);
    function noteSettlement(uint256 volumeUSDC, uint256 feeUSDC) external;
}
