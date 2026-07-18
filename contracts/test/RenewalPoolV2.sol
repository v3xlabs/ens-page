// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {RenewalPool} from "../src/RenewalPool.sol";

contract RenewalPoolV2 is RenewalPool {
    function version() external pure returns (uint256) {
        return 2;
    }
}
