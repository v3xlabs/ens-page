// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {UltraBulk} from "../UltraBulk.sol";
import {IRenewalModule} from "./IRenewalModule.sol";
import {IBaseRegistrar} from "./IENSV1.sol";

interface IRenewalPoolFactory {
    function ultraBulk() external view returns (UltraBulk);

    function baseRegistrar() external view returns (IBaseRegistrar);

    function isDurationAllowed(uint256 duration) external view returns (bool);

    function isAdapterAllowed(address adapter) external view returns (bool);

    function isModuleAllowed(IRenewalModule module) external view returns (bool);

    function isImplementationAllowed(address implementation) external view returns (bool);
}
