// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IERC20} from "./IERC20.sol";

interface IENSV2ExpiryRegistry {
    function findExpiry(string calldata label) external view returns (uint64);
}

interface IETHRenewer {
    function getRenewPrice(string calldata label, uint64 duration, IERC20 paymentToken) external view returns (uint256);

    function renew(string calldata label, uint64 duration, IERC20 paymentToken, bytes32 referrer) external;
}
