// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {UltraBulk} from "./UltraBulk.sol";
import {RenewalPool} from "./RenewalPool.sol";
import {IBaseRegistrar} from "./interfaces/IENSV1.sol";
import {IRenewalPoolFactory} from "./interfaces/IRenewalPoolFactory.sol";
import {IRenewalModule} from "./interfaces/IRenewalModule.sol";
import {Ownable} from "solady/auth/Ownable.sol";
import {LibClone} from "solady/utils/LibClone.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";

/// @notice Deploys renewal pools using durations and renewal adapters approved by its owner.
contract RenewalPoolFactory is Ownable {
    error InvalidAddress();
    error ImplementationNotAllowed(address implementation);
    error UnknownPool(address pool);
    error InvalidRenewalCall();
    error ProtocolContractsNotConfigured();

    mapping(uint256 duration => bool allowed) public isDurationAllowed;
    mapping(address adapter => bool allowed) public isAdapterAllowed;
    mapping(IRenewalModule module => bool allowed) public isModuleAllowed;
    mapping(address implementation => bool allowed) public isImplementationAllowed;
    mapping(address pool => bool valid) public isPool;
    address[] private allPools;
    address public defaultImplementation;
    UltraBulk public ultraBulk;
    IBaseRegistrar public baseRegistrar;

    event DurationAllowed(uint256 indexed duration, bool allowed);
    event AdapterAllowed(address indexed adapter, bool allowed);
    event ModuleAllowed(IRenewalModule indexed module, bool allowed);
    event ImplementationAllowed(address indexed implementation, bool allowed);
    event DefaultImplementationSet(address indexed implementation);
    event PoolCreated(address indexed pool, address indexed poolOwner);
    event ProtocolContractsSet(address indexed ultraBulk, address indexed baseRegistrar);

    /**
     * EXECUTION
     */

    function execute(address[] calldata pools, bytes[] calldata calls) external {
        if (pools.length != calls.length) revert InvalidAddress();
        uint256 balanceBefore = address(this).balance;
        for (uint256 i; i < pools.length; ++i) {
            if (!isPool[pools[i]]) revert UnknownPool(pools[i]);
            bytes calldata callData = calls[i];
            if (callData.length < 4) revert InvalidRenewalCall();
            bytes4 selector;
            assembly ("memory-safe") {
                selector := calldataload(callData.offset)
            }
            if (selector != RenewalPool.renew.selector && selector != RenewalPool.executeModule.selector) {
                revert InvalidRenewalCall();
            }
            (bool callSucceeded,) = pools[i].call(calls[i]);
            if (!callSucceeded) revert InvalidRenewalCall();
        }
        uint256 reward = address(this).balance - balanceBefore;
        if (reward == 0) return;
        SafeTransferLib.safeTransferETH(msg.sender, reward);
    }

    /**
     * POOL CREATION
     */

    function createPool(address poolOwner) external returns (RenewalPool pool) {
        pool = _createPool(defaultImplementation, poolOwner);
    }

    function createPoolWithImplementation(address implementation, address poolOwner)
        external
        returns (RenewalPool pool)
    {
        if (!isImplementationAllowed[implementation]) {
            revert ImplementationNotAllowed(implementation);
        }
        pool = _createPool(implementation, poolOwner);
    }

    function _createPool(address implementation, address poolOwner) private returns (RenewalPool pool) {
        if (address(ultraBulk) == address(0) || address(baseRegistrar) == address(0)) {
            revert ProtocolContractsNotConfigured();
        }
        pool = RenewalPool(payable(LibClone.deployERC1967(implementation)));
        pool.initialize(poolOwner, IRenewalPoolFactory(address(this)));
        isPool[address(pool)] = true;
        allPools.push(address(pool));
        emit PoolCreated(address(pool), poolOwner);
    }

    function getPools() external view returns (address[] memory) {
        return allPools;
    }

    /**
     * RECEIVE FUNCTIONS
     */

    receive() external payable {}

    /**
     * OWNER FUNCTIONS
     */

    constructor(address owner_) {
        if (owner_ == address(0)) revert InvalidAddress();
        _initializeOwner(owner_);
        defaultImplementation = address(new RenewalPool());
        isImplementationAllowed[defaultImplementation] = true;
        emit ImplementationAllowed(defaultImplementation, true);
        emit DefaultImplementationSet(defaultImplementation);
    }

    function setDurationAllowed(uint256 duration, bool allowed) external onlyOwner {
        isDurationAllowed[duration] = allowed;
        emit DurationAllowed(duration, allowed);
    }

    function setProtocolContracts(UltraBulk ultraBulk_, IBaseRegistrar baseRegistrar_) external onlyOwner {
        if (address(ultraBulk_) == address(0) || address(baseRegistrar_) == address(0)) revert InvalidAddress();
        ultraBulk = ultraBulk_;
        baseRegistrar = baseRegistrar_;
        emit ProtocolContractsSet(address(ultraBulk_), address(baseRegistrar_));
    }

    function setAdapterAllowed(address adapter, bool allowed) external onlyOwner {
        if (adapter == address(0)) revert InvalidAddress();
        isAdapterAllowed[adapter] = allowed;
        emit AdapterAllowed(adapter, allowed);
    }

    function setModuleAllowed(IRenewalModule module, bool allowed) external onlyOwner {
        if (address(module) == address(0)) revert InvalidAddress();
        isModuleAllowed[module] = allowed;
        emit ModuleAllowed(module, allowed);
    }

    function setImplementationAllowed(address implementation, bool allowed) external onlyOwner {
        if (implementation == address(0)) revert InvalidAddress();
        if (!allowed && implementation == defaultImplementation) {
            revert ImplementationNotAllowed(implementation);
        }
        isImplementationAllowed[implementation] = allowed;
        emit ImplementationAllowed(implementation, allowed);
    }

    function setDefaultImplementation(address implementation) external onlyOwner {
        if (!isImplementationAllowed[implementation]) {
            revert ImplementationNotAllowed(implementation);
        }
        defaultImplementation = implementation;
        emit DefaultImplementationSet(implementation);
    }
}
