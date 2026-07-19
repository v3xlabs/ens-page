// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IPoolAdapter} from "../interfaces/IPoolAdapter.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

interface IWETH {
    function withdraw(uint256 amount) external;
}

interface IAggregatorV3 {
    function decimals() external view returns (uint8);

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

interface IERC20Metadata {
    function decimals() external view returns (uint8);
}

/// @notice Swaps a route step's input through a Uniswap V3 style router.
///
/// Step configuration (owner-set on the pool, abi-encoded `SwapConfig`):
/// - `tokenOut`/`fee` select the Uniswap pool.
/// - `minOutPerWad` is a manual slippage floor: minimum output units per 1e18
///   input units.
/// - `oracleSlippageBps` guards stablecoin swaps with the same ETH/USD oracle
///   family the ENS registrar prices against: the input is assumed to be worth
///   $1 per token, the oracle converts that to expected wei, and the swap must
///   deliver at least `expected * (10000 - bps) / 10000`.
/// - `unwrapNative` requires `tokenOut == weth` and delivers ETH to the pool.
///
/// Routes are executable by anyone, so these floors are what stop a relayer
/// from sandwiching the pool's conversion.
contract SwapAdapter is IPoolAdapter {
    struct SwapConfig {
        address tokenOut;
        uint24 fee;
        uint256 minOutPerWad;
        uint16 oracleSlippageBps;
        bool unwrapNative;
    }

    error UnwrapRequiresWeth(address tokenOut);
    error OraclePriceInvalid();

    ISwapRouter public immutable swapRouter;
    address public immutable weth;
    IAggregatorV3 public immutable ethUsdOracle;

    constructor(ISwapRouter swapRouter_, address weth_, IAggregatorV3 ethUsdOracle_) {
        swapRouter = swapRouter_;
        weth = weth_;
        ethUsdOracle = ethUsdOracle_;
    }

    receive() external payable {}

    function adapterType() external pure returns (string memory) {
        return "swap";
    }

    function execute(address pool, address tokenIn, uint256 amountIn, bytes calldata data)
        external
        returns (address tokenOut, uint256 amountOut)
    {
        SwapConfig memory config = abi.decode(data, (SwapConfig));
        if (config.unwrapNative && config.tokenOut != weth) revert UnwrapRequiresWeth(config.tokenOut);

        uint256 minOut = (amountIn * config.minOutPerWad) / 1e18;
        if (config.oracleSlippageBps > 0) {
            uint256 oracleFloor = _oracleFloorWei(tokenIn, amountIn, config.oracleSlippageBps);
            if (oracleFloor > minOut) minOut = oracleFloor;
        }

        SafeTransferLib.safeApprove(tokenIn, address(swapRouter), amountIn);
        amountOut = swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: config.tokenOut,
                fee: config.fee,
                recipient: config.unwrapNative ? address(this) : pool,
                amountIn: amountIn,
                amountOutMinimum: minOut,
                sqrtPriceLimitX96: 0
            })
        );

        if (config.unwrapNative) {
            IWETH(weth).withdraw(amountOut);
            SafeTransferLib.safeTransferETH(pool, amountOut);
            return (address(0), amountOut);
        }

        return (config.tokenOut, amountOut);
    }

    function _oracleFloorWei(address tokenIn, uint256 amountIn, uint16 slippageBps) private view returns (uint256) {
        (, int256 answer,,,) = ethUsdOracle.latestRoundData();
        if (answer <= 0) revert OraclePriceInvalid();
        uint256 tokenScale = 10 ** IERC20Metadata(tokenIn).decimals();
        uint256 oracleScale = 10 ** ethUsdOracle.decimals();
        uint256 expectedWei = (amountIn * 1e18 * oracleScale) / tokenScale / uint256(answer);
        return (expectedWei * (10_000 - slippageBps)) / 10_000;
    }
}
