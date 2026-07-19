// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {UltraBulk} from "../src/UltraBulk.sol";
import {RenewalPool} from "../src/RenewalPool.sol";
import {RenewalPoolFactory} from "../src/RenewalPoolFactory.sol";
import {SwapAdapter, ISwapRouter, IAggregatorV3} from "../src/adapters/SwapAdapter.sol";
import {StreamAdapter} from "../src/adapters/StreamAdapter.sol";
import {YieldAdapter} from "../src/adapters/YieldAdapter.sol";
import {IPoolAdapter} from "../src/interfaces/IPoolAdapter.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";
import {PoolMockBaseRegistrar, PoolMockEthController} from "./RenewalPool.t.sol";

interface Vm {
    function deal(address account, uint256 newBalance) external;
    function expectRevert() external;
    function expectRevert(bytes calldata revertData) external;
    function prank(address msgSender) external;
    function warp(uint256 newTimestamp) external;
}

contract MockERC20 {
    mapping(address account => uint256 balance) public balanceOf;
    mapping(address account => mapping(address spender => uint256 amount)) public allowance;

    function decimals() external pure returns (uint8) {
        return 18;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (allowance[from][msg.sender] != type(uint256).max) allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract MockWETH is MockERC20 {
    receive() external payable {}

    function deposit() external payable {
        balanceOf[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) external {
        balanceOf[msg.sender] -= amount;
        SafeTransferLib.safeTransferETH(msg.sender, amount);
    }
}

contract MockSwapRouter {
    mapping(address tokenIn => mapping(address tokenOut => uint256 rate)) public ratePerWad;

    function setRate(address tokenIn, address tokenOut, uint256 rate) external {
        ratePerWad[tokenIn][tokenOut] = rate;
    }

    function exactInputSingle(ISwapRouter.ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut)
    {
        MockERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);
        amountOut = (params.amountIn * ratePerWad[params.tokenIn][params.tokenOut]) / 1e18;
        require(amountOut >= params.amountOutMinimum, "slippage");
        MockERC20(params.tokenOut).transfer(params.recipient, amountOut);
    }
}

contract MockEthUsdOracle {
    int256 public answer = 3000e8;

    function setAnswer(int256 answer_) external {
        answer = answer_;
    }

    function decimals() external pure returns (uint8) {
        return 8;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (0, answer, 0, 0, 0);
    }
}

contract MockVault is MockERC20 {
    MockERC20 public immutable underlying;

    constructor(MockERC20 underlying_) {
        underlying = underlying_;
    }

    function asset() external view returns (address) {
        return address(underlying);
    }

    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
        require(msg.sender == owner, "owner");
        balanceOf[owner] -= shares;
        underlying.transfer(receiver, shares);
        return shares;
    }
}

contract AdaptersTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    MockERC20 private usdc;
    MockWETH private weth;
    MockSwapRouter private router;
    MockEthUsdOracle private oracle;
    MockVault private vault;
    SwapAdapter private swapAdapter;
    YieldAdapter private yieldAdapter;
    StreamAdapter private streamAdapter;
    RenewalPoolFactory private factory;
    RenewalPool private pool;
    PoolMockEthController private controller;
    PoolMockBaseRegistrar private registrar;

    receive() external payable {}

    function setUp() public {
        usdc = new MockERC20();
        weth = new MockWETH();
        router = new MockSwapRouter();
        oracle = new MockEthUsdOracle();
        vault = new MockVault(usdc);
        swapAdapter = new SwapAdapter(ISwapRouter(address(router)), address(weth), IAggregatorV3(address(oracle)));
        yieldAdapter = new YieldAdapter();
        streamAdapter = new StreamAdapter();

        factory = new RenewalPoolFactory(address(this));
        controller = new PoolMockEthController();
        registrar = new PoolMockBaseRegistrar();
        factory.setProtocolContracts(new UltraBulk(controller), registrar);
        factory.setDurationAllowed(365 days, true);
        factory.setAdapterAllowed(address(swapAdapter), true);
        factory.setAdapterAllowed(address(yieldAdapter), true);
        factory.setAdapterAllowed(address(streamAdapter), true);
        pool = factory.createPool(address(this));
        _setAdapterEnabled(address(swapAdapter), true);
        _setAdapterEnabled(address(yieldAdapter), true);

        // Router liquidity: 1 USDC (wad) buys 0.001 WETH.
        weth.deposit{value: 100 ether}();
        weth.transfer(address(router), 100 ether);
        router.setRate(address(usdc), address(weth), 1e15);
    }

    function _setAdapterEnabled(address adapter, bool enabled) private {
        RenewalPool.AdapterSetting[] memory settings = new RenewalPool.AdapterSetting[](1);
        settings[0] = RenewalPool.AdapterSetting({adapter: adapter, enabled: enabled});
        pool.configureAdapters(settings, new RenewalPool.TokenRoute[](0));
    }

    function _setTokenRoute(address token, RenewalPool.RouteStep[] memory steps) private {
        RenewalPool.TokenRoute[] memory routes = new RenewalPool.TokenRoute[](1);
        routes[0] = RenewalPool.TokenRoute({token: token, steps: steps});
        pool.configureAdapters(new RenewalPool.AdapterSetting[](0), routes);
    }

    function _swapStep(bool unwrapNative, uint256 minOutPerWad, uint16 oracleSlippageBps)
        private
        view
        returns (RenewalPool.RouteStep memory)
    {
        return RenewalPool.RouteStep({
            adapter: IPoolAdapter(address(swapAdapter)),
            data: abi.encode(
                SwapAdapter.SwapConfig({
                    tokenOut: address(weth),
                    fee: 500,
                    minOutPerWad: minOutPerWad,
                    oracleSlippageBps: oracleSlippageBps,
                    unwrapNative: unwrapNative
                })
            )
        });
    }

    function _configureUsdcRoute(bool unwrapNative, uint256 minOutPerWad) private {
        RenewalPool.RouteStep[] memory steps = new RenewalPool.RouteStep[](1);
        steps[0] = _swapStep(unwrapNative, minOutPerWad, 0);
        _setTokenRoute(address(usdc), steps);
    }

    function test_RouteConfigurationIsOwnerOnly() public {
        RenewalPool.TokenRoute[] memory routes = new RenewalPool.TokenRoute[](1);
        routes[0].token = address(usdc);
        routes[0].steps = new RenewalPool.RouteStep[](1);
        routes[0].steps[0] = _swapStep(true, 0, 0);
        vm.prank(address(0xBEEF));
        vm.expectRevert();
        pool.configureAdapters(new RenewalPool.AdapterSetting[](0), routes);
    }

    function test_RouteRejectsDisabledAdapter() public {
        _setAdapterEnabled(address(swapAdapter), false);
        RenewalPool.RouteStep[] memory steps = new RenewalPool.RouteStep[](1);
        steps[0] = _swapStep(true, 0, 0);
        vm.expectRevert(abi.encodeWithSelector(RenewalPool.AdapterNotEnabled.selector, address(swapAdapter)));
        _setTokenRoute(address(usdc), steps);
    }

    function test_SingleCallConfiguresAdaptersAndRoutes() public {
        _setAdapterEnabled(address(swapAdapter), false);
        _setAdapterEnabled(address(yieldAdapter), false);

        RenewalPool.AdapterSetting[] memory settings = new RenewalPool.AdapterSetting[](2);
        settings[0] = RenewalPool.AdapterSetting({adapter: address(swapAdapter), enabled: true});
        settings[1] = RenewalPool.AdapterSetting({adapter: address(streamAdapter), enabled: true});
        RenewalPool.TokenRoute[] memory routes = new RenewalPool.TokenRoute[](1);
        routes[0].token = address(usdc);
        routes[0].steps = new RenewalPool.RouteStep[](1);
        routes[0].steps[0] = _swapStep(true, 0, 0);

        pool.configureAdapters(settings, routes);

        require(pool.isAdapterEnabled(address(swapAdapter)), "swap not enabled");
        require(pool.isAdapterEnabled(address(streamAdapter)), "stream not enabled");
        require(pool.getTokenRoute(address(usdc)).length == 1, "route not stored");
    }

    function test_EmptyRouteClearsConfiguration() public {
        _configureUsdcRoute(true, 0);
        _setTokenRoute(address(usdc), new RenewalPool.RouteStep[](0));
        require(pool.getTokenRoute(address(usdc)).length == 0, "route not cleared");
        vm.expectRevert(abi.encodeWithSelector(RenewalPool.RouteNotConfigured.selector, address(usdc)));
        pool.executeRoute(address(usdc), 1e18);
    }

    function test_OracleGuardBlocksUnderpricedSwap() public {
        // Oracle says 1 ETH = $50, so 10 "dollars" of input must fetch ≥ ~0.198
        // ETH — far above the router's 0.001 ETH/token rate.
        oracle.setAnswer(50e8);
        RenewalPool.RouteStep[] memory steps = new RenewalPool.RouteStep[](1);
        steps[0] = _swapStep(true, 0, 100);
        _setTokenRoute(address(usdc), steps);
        usdc.mint(address(pool), 10e18);
        vm.expectRevert();
        pool.executeRoute(address(usdc), 10e18);
    }

    function test_OracleGuardAllowsFairSwap() public {
        // Oracle at $3000 expects ~0.00333 ETH for 10 tokens; the router pays
        // 0.01 ETH, comfortably above the guarded floor.
        RenewalPool.RouteStep[] memory steps = new RenewalPool.RouteStep[](1);
        steps[0] = _swapStep(true, 0, 100);
        _setTokenRoute(address(usdc), steps);
        usdc.mint(address(pool), 10e18);
        uint256 ethOut = pool.executeRoute(address(usdc), 10e18);
        require(ethOut == 0.01 ether, "guarded swap failed");
    }

    function test_ExecuteRouteSwapsAndUnwrapsToEth() public {
        _configureUsdcRoute(true, 0);
        usdc.mint(address(pool), 10e18);

        uint256 ethOut = pool.executeRoute(address(usdc), 10e18);

        require(ethOut == 0.01 ether, "wrong eth out");
        require(address(pool).balance == 0.01 ether, "pool eth missing");
        require(usdc.balanceOf(address(pool)) == 0, "usdc not spent");
    }

    function test_ExecuteRouteIsPermissionless() public {
        _configureUsdcRoute(true, 0);
        usdc.mint(address(pool), 10e18);
        vm.prank(address(0xBEEF));
        pool.executeRoute(address(usdc), 10e18);
        require(address(pool).balance == 0.01 ether, "route not executed");
    }

    function test_ExecuteRouteRejectsTokenOutput() public {
        _configureUsdcRoute(false, 0);
        usdc.mint(address(pool), 10e18);
        vm.expectRevert(abi.encodeWithSelector(RenewalPool.RouteOutputNotEth.selector, address(weth)));
        pool.executeRoute(address(usdc), 10e18);
    }

    function test_ExecuteRouteEnforcesSlippageFloor() public {
        // Floor above the router rate: 0.002 WETH per USDC vs actual 0.001.
        _configureUsdcRoute(true, 2e15);
        usdc.mint(address(pool), 10e18);
        vm.expectRevert();
        pool.executeRoute(address(usdc), 10e18);
    }

    function test_StackedRouteRedeemsThenSwaps() public {
        usdc.mint(address(vault), 5e18);
        vault.mint(address(pool), 5e18);

        RenewalPool.RouteStep[] memory steps = new RenewalPool.RouteStep[](2);
        steps[0] = RenewalPool.RouteStep({adapter: IPoolAdapter(address(yieldAdapter)), data: ""});
        steps[1] = _swapStep(true, 0, 0);
        _setTokenRoute(address(vault), steps);

        uint256 ethOut = pool.executeRoute(address(vault), 5e18);

        require(ethOut == 0.005 ether, "wrong stacked output");
        require(vault.balanceOf(address(pool)) == 0, "shares not redeemed");
    }

    function test_RenewWithRoutePaysRenewalAndReward() public {
        controller.setPrice("alpha", 0.004 ether);
        registrar.setExpiry("alpha", block.timestamp + 1 days);
        pool.configureLabel("alpha", uint64(365 days), uint64(30 days));
        pool.configureReward(0, 0, 0.001 ether);
        _configureUsdcRoute(true, 0);
        usdc.mint(address(pool), 10e18);

        UltraBulk.PriceGroup[] memory groups = new UltraBulk.PriceGroup[](1);
        groups[0].names = new string[](1);
        groups[0].names[0] = "alpha";
        groups[0].duration = 365 days;
        groups[0].price = 0.004 ether;

        address relayer = address(0xBEEF);
        vm.prank(relayer);
        pool.renewWithRoute(address(usdc), 10e18, groups);

        require(controller.renewals(keccak256("alpha")) == 1, "not renewed");
        require(relayer.balance == 0.001 ether, "reward not paid");
        require(address(pool).balance == 0.005 ether, "wrong remaining balance");
    }

    function test_StreamAccruesLinearlyAndClaimsToPool() public {
        uint256 streamId = streamAdapter.createEthStream{value: 1 ether}(address(pool), 100);

        vm.warp(block.timestamp + 50);
        require(streamAdapter.accruedOf(streamId) == 0.5 ether, "wrong midpoint accrual");
        vm.prank(address(0xBEEF));
        streamAdapter.claim(streamId);
        require(address(pool).balance == 0.5 ether, "midpoint claim missing");

        vm.warp(block.timestamp + 100);
        streamAdapter.claim(streamId);
        require(address(pool).balance == 1 ether, "final claim incomplete");
        require(streamAdapter.accruedOf(streamId) == 0, "still accruing");
    }

    function test_StreamCancelRefundsUnvested() public {
        vm.deal(address(0xCAFE), 1 ether);
        vm.prank(address(0xCAFE));
        uint256 streamId = streamAdapter.createEthStream{value: 1 ether}(address(pool), 100);

        vm.warp(block.timestamp + 25);
        vm.prank(address(0xBEEF));
        vm.expectRevert(abi.encodeWithSelector(StreamAdapter.NotStreamPayer.selector, streamId));
        streamAdapter.cancel(streamId);

        vm.prank(address(0xCAFE));
        streamAdapter.cancel(streamId);
        require(address(pool).balance == 0.25 ether, "vested not paid");
        require(address(0xCAFE).balance == 0.75 ether, "refund missing");
        require(streamAdapter.accruedOf(streamId) == 0, "cancelled stream accrues");
    }

    function test_TokenStreamClaimsToPool() public {
        usdc.mint(address(this), 4e18);
        usdc.approve(address(streamAdapter), 4e18);
        uint256 streamId = streamAdapter.createTokenStream(address(pool), address(usdc), 4e18, 100);

        vm.warp(block.timestamp + 100);
        streamAdapter.claim(streamId);
        require(usdc.balanceOf(address(pool)) == 4e18, "token stream not claimed");
    }

    function test_StreamAdapterIsNotARouteStep() public {
        _setAdapterEnabled(address(streamAdapter), true);
        RenewalPool.RouteStep[] memory steps = new RenewalPool.RouteStep[](1);
        steps[0] = RenewalPool.RouteStep({adapter: IPoolAdapter(address(streamAdapter)), data: ""});
        _setTokenRoute(address(usdc), steps);
        usdc.mint(address(pool), 1e18);
        vm.expectRevert(abi.encodeWithSelector(StreamAdapter.NotARouteStep.selector));
        pool.executeRoute(address(usdc), 1e18);
    }

    function test_FactoryEnumeratesAdaptersOnce() public {
        factory.setAdapterAllowed(address(swapAdapter), false);
        factory.setAdapterAllowed(address(swapAdapter), true);
        address[] memory adapters = factory.getAdapters();
        require(adapters.length == 3, "wrong adapter count");
        require(
            keccak256(bytes(IPoolAdapter(adapters[0]).adapterType())) == keccak256("swap"), "missing swap type"
        );
    }
}
