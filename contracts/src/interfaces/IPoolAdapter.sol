// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice A stateless conversion step in a pool's token route.
///
/// The pool pushes `amountIn` of `tokenIn` to the adapter, then calls
/// `execute`. The adapter converts the tokens and delivers all proceeds back
/// to `pool` before returning. `tokenOut` is `address(0)` when the proceeds
/// are native ETH.
interface IPoolAdapter {
    function execute(address pool, address tokenIn, uint256 amountIn, bytes calldata data)
        external
        returns (address tokenOut, uint256 amountOut);

    /// @notice Human-readable adapter kind for discovery: "swap", "yield", or "stream".
    function adapterType() external pure returns (string memory);
}
