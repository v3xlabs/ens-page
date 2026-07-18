// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {UltraBulk} from "./UltraBulk.sol";
import {IRenewalModule} from "./interfaces/IRenewalModule.sol";

interface IENSv1RenewalPool {
    function renewFromModule(UltraBulk.PriceGroup[] calldata groups) external;
}

contract ENSv1RenewalModule is IRenewalModule {
    function renew(address pool, UltraBulk.PriceGroup[] calldata groups) external {
        IENSv1RenewalPool(pool).renewFromModule(groups);
    }
}
