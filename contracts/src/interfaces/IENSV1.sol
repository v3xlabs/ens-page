// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IBaseRegistrar {
    function nameExpires(uint256 id) external view returns (uint256);
}

interface IETHRegistrarController {
    function rentPrice(string calldata name, uint256 duration) external view returns (uint256 price);

    function renew(string calldata name, uint256 duration) external payable;
}
