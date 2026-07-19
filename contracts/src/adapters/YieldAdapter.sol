// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IPoolAdapter} from "../interfaces/IPoolAdapter.sol";

interface IERC4626 {
    function asset() external view returns (address);

    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
}

/// @notice Redeems ERC4626 vault shares into their underlying asset.
///
/// The route step's input token is the vault itself (its shares are what the
/// pool holds); the redeemed assets are delivered straight to the pool so the
/// next step can pick them up. Requires no step configuration.
contract YieldAdapter is IPoolAdapter {
    function adapterType() external pure returns (string memory) {
        return "yield";
    }

    function execute(address pool, address tokenIn, uint256 amountIn, bytes calldata)
        external
        returns (address tokenOut, uint256 amountOut)
    {
        IERC4626 vault = IERC4626(tokenIn);
        amountOut = vault.redeem(amountIn, pool, address(this));
        tokenOut = vault.asset();
    }
}
