// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {UltraBulk} from "../src/UltraBulk.sol";
import {ENSv1RenewalModule} from "../src/ENSv1RenewalModule.sol";
import {RenewalPool} from "../src/RenewalPool.sol";
import {RenewalPoolFactory} from "../src/RenewalPoolFactory.sol";
import {RenewalPoolV2} from "./RenewalPoolV2.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";
import {IRenewalPoolFactory} from "../src/interfaces/IRenewalPoolFactory.sol";
import {IBaseRegistrar, IETHRegistrarController} from "../src/interfaces/IENSV1.sol";

interface Vm {
    function deal(address account, uint256 newBalance) external;
    function expectRevert() external;
    function expectRevert(bytes4 revertData) external;
    function prank(address msgSender) external;
    function txGasPrice(uint256 newGasPrice) external;
}

contract PoolUnauthorizedCaller {
    function setProtocolContracts(RenewalPoolFactory factory, UltraBulk bulk, IBaseRegistrar registrar) external {
        factory.setProtocolContracts(bulk, registrar);
    }
}

contract PoolMockEthController is IETHRegistrarController {
    mapping(bytes32 labelHash => uint256 price) public prices;
    mapping(bytes32 labelHash => uint256 renewals) public renewals;

    function setPrice(string calldata label, uint256 price) external {
        prices[keccak256(bytes(label))] = price;
    }

    function rentPrice(string calldata label, uint256) external view returns (uint256) {
        return prices[keccak256(bytes(label))];
    }

    function renew(string calldata label, uint256) external payable {
        require(msg.value == prices[keccak256(bytes(label))], "price");
        ++renewals[keccak256(bytes(label))];
    }
}

contract PoolMockBaseRegistrar is IBaseRegistrar {
    mapping(uint256 labelHash => uint256 expiry) public expiries;

    function setExpiry(string calldata label, uint256 expiry) external {
        expiries[uint256(keccak256(bytes(label)))] = expiry;
    }

    function nameExpires(uint256 labelHash) external view returns (uint256) {
        return expiries[labelHash];
    }
}

contract RenewalPoolTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    receive() external payable {}

    function test_FactoryRequiresV1ContractsBeforePoolCreation() public {
        RenewalPoolFactory factory = new RenewalPoolFactory(address(this));
        vm.expectRevert(RenewalPoolFactory.ProtocolContractsNotConfigured.selector);
        factory.createPool(address(this));
    }

    function test_FactoryOwnerConfiguresV1Contracts() public {
        (RenewalPoolFactory factory, UltraBulk bulk,,) = _deploy();
        PoolUnauthorizedCaller attacker = new PoolUnauthorizedCaller();
        PoolMockBaseRegistrar registrar = new PoolMockBaseRegistrar();
        vm.expectRevert();
        attacker.setProtocolContracts(factory, bulk, registrar);
    }

    function test_FactoryListsCreatedPools() public {
        (RenewalPoolFactory factory,,,) = _deploy();

        RenewalPool firstPool = factory.createPool(address(this));
        RenewalPool secondPool = factory.createPool(address(0xBEEF));
        address[] memory pools = factory.getPools();

        require(pools.length == 2, "wrong pool count");
        require(pools[0] == address(firstPool), "first pool missing");
        require(pools[1] == address(secondPool), "second pool missing");
    }

    function test_PoolResolvesUpdatedFactoryContracts() public {
        (RenewalPoolFactory factory,,,) = _deploy();
        RenewalPool pool = factory.createPool(address(this));
        UltraBulk replacement = new UltraBulk(new PoolMockEthController());
        PoolMockBaseRegistrar registrar = new PoolMockBaseRegistrar();

        factory.setProtocolContracts(replacement, registrar);

        require(address(pool.ultraBulk()) == address(replacement), "bulk not updated");
        require(address(pool.baseRegistrar()) == address(registrar), "registrar not updated");
    }

    function test_PoolListsAndRemovesConfiguredLabels() public {
        (RenewalPoolFactory factory,,,) = _deploy();
        factory.setDurationAllowed(365 days, true);
        RenewalPool pool = factory.createPool(address(this));
        pool.configureLabel("alpha", uint64(365 days), 1 days);
        pool.configureLabel("beta", uint64(365 days), 2 days);

        string[] memory labels = pool.getLabels();
        require(labels.length == 2, "wrong label count");
        require(keccak256(bytes(labels[0])) == keccak256("alpha"), "alpha missing");
        require(keccak256(bytes(labels[1])) == keccak256("beta"), "beta missing");

        pool.removeLabel("alpha");
        labels = pool.getLabels();
        require(labels.length == 1, "label not removed");
        require(keccak256(bytes(labels[0])) == keccak256("beta"), "beta not retained");
        require(!pool.labelConfig("alpha").configured, "alpha still configured");
    }

    function test_PoolUpdatesLabelsInOneCall() public {
        (RenewalPoolFactory factory,,,) = _deploy();
        factory.setDurationAllowed(365 days, true);
        RenewalPool pool = factory.createPool(address(this));
        pool.configureLabel("alpha", uint64(365 days), 1 days);

        string[] memory additions = new string[](2);
        additions[0] = "beta";
        additions[1] = "gamma";
        string[] memory removals = new string[](1);
        removals[0] = "alpha";

        pool.updateLabels(additions, removals);

        string[] memory labels = pool.getLabels();
        require(labels.length == 2, "wrong batch label count");
        require(!pool.labelConfig("alpha").configured, "alpha still configured");
        require(pool.labelConfig("beta").configured, "beta missing");
        require(pool.labelConfig("gamma").configured, "gamma missing");
    }

    function test_PoolUpgradePreservesV1Configuration() public {
        (RenewalPoolFactory factory,,,) = _deploy();
        factory.setDurationAllowed(365 days, true);
        RenewalPool pool = factory.createPool(address(this));
        pool.configureLabel("alpha", uint64(365 days), 1 days);
        RenewalPoolV2 implementation = new RenewalPoolV2();
        factory.setImplementationAllowed(address(implementation), true);

        pool.upgradeToAndCall(address(implementation), "");

        RenewalPool.LabelConfig memory config = pool.labelConfig("alpha");
        require(config.configured, "label lost");
        require(config.duration == 365 days, "duration lost");
    }

    function test_RenewsDueEthLabelAndPaysReward() public {
        (RenewalPoolFactory factory,, PoolMockEthController controller, PoolMockBaseRegistrar registrar) = _deploy();
        factory.setDurationAllowed(365 days, true);
        RenewalPool pool = factory.createPool(address(this));
        pool.configureLabel("alpha", uint64(365 days), 1 days);
        pool.configureReward(1, 1, 2);
        registrar.setExpiry("alpha", block.timestamp);
        controller.setPrice("alpha", 4);
        vm.deal(address(pool), 7);
        vm.txGasPrice(1);

        UltraBulk.PriceGroup[] memory groups = _group("alpha", 365 days, 4);
        uint256 balanceBefore = address(this).balance;
        pool.renew(groups);

        require(controller.renewals(keccak256("alpha")) == 1, "name not renewed");
        require(address(this).balance == balanceBefore + 3, "reward not paid");
    }

    function test_RevertsForNotDueOrEmptyPlans() public {
        (RenewalPoolFactory factory,, PoolMockEthController controller, PoolMockBaseRegistrar registrar) = _deploy();
        factory.setDurationAllowed(365 days, true);
        RenewalPool pool = factory.createPool(address(this));
        pool.configureLabel("alpha", uint64(365 days), 1 days);
        registrar.setExpiry("alpha", block.timestamp + 2 days);
        controller.setPrice("alpha", 1);
        vm.deal(address(pool), 1 ether);

        vm.expectRevert();
        pool.renew(_group("alpha", 365 days, 1));

        UltraBulk.PriceGroup[] memory empty = new UltraBulk.PriceGroup[](1);
        empty[0].names = new string[](0);
        vm.expectRevert(RenewalPool.EmptyPlan.selector);
        pool.renew(empty);
    }

    function test_FactoryExecutesRenewalsOnly() public {
        (RenewalPoolFactory factory,, PoolMockEthController controller, PoolMockBaseRegistrar registrar) = _deploy();
        factory.setDurationAllowed(365 days, true);
        RenewalPool pool = factory.createPool(address(this));
        pool.configureLabel("alpha", uint64(365 days), 1 days);
        registrar.setExpiry("alpha", block.timestamp);
        controller.setPrice("alpha", 1);
        vm.deal(address(pool), 1);

        address[] memory pools = new address[](1);
        pools[0] = address(pool);
        bytes[] memory calls = new bytes[](1);
        calls[0] = abi.encodeWithSelector(RenewalPool.configureReward.selector, 0, 0, 0);
        vm.expectRevert(RenewalPoolFactory.InvalidRenewalCall.selector);
        factory.execute(pools, calls);

        calls[0] = abi.encodeWithSelector(RenewalPool.renew.selector, _group("alpha", 365 days, 1));
        factory.execute(pools, calls);
        require(controller.renewals(keccak256("alpha")) == 1, "factory did not renew");
    }

    function test_EnabledModuleCanRequestOnlyV1Renewals() public {
        (RenewalPoolFactory factory,, PoolMockEthController controller, PoolMockBaseRegistrar registrar) = _deploy();
        factory.setDurationAllowed(365 days, true);
        RenewalPool pool = factory.createPool(address(this));
        ENSv1RenewalModule module = new ENSv1RenewalModule();
        UltraBulk.PriceGroup[] memory groups = _group("alpha", 365 days, 1);
        pool.configureLabel("alpha", uint64(365 days), 1 days);
        registrar.setExpiry("alpha", block.timestamp);
        controller.setPrice("alpha", 1);
        vm.deal(address(pool), 1);

        vm.expectRevert();
        module.renew(address(pool), groups);

        factory.setModuleAllowed(module, true);
        pool.setModuleEnabled(module, true);
        bytes memory moduleCall = abi.encodeWithSelector(module.renew.selector, address(pool), groups);
        address[] memory pools = new address[](1);
        pools[0] = address(pool);
        bytes[] memory calls = new bytes[](1);
        calls[0] = abi.encodeWithSelector(RenewalPool.executeModule.selector, module, moduleCall);

        factory.execute(pools, calls);

        require(controller.renewals(keccak256("alpha")) == 1, "module did not renew");
    }

    function _deploy()
        private
        returns (
            RenewalPoolFactory factory,
            UltraBulk bulk,
            PoolMockEthController controller,
            PoolMockBaseRegistrar registrar
        )
    {
        controller = new PoolMockEthController();
        bulk = new UltraBulk(controller);
        registrar = new PoolMockBaseRegistrar();
        factory = new RenewalPoolFactory(address(this));
        factory.setProtocolContracts(bulk, registrar);
    }

    function _group(string memory label, uint256 duration, uint256 price)
        private
        pure
        returns (UltraBulk.PriceGroup[] memory groups)
    {
        groups = new UltraBulk.PriceGroup[](1);
        groups[0].names = new string[](1);
        groups[0].names[0] = label;
        groups[0].duration = duration;
        groups[0].price = price;
    }
}
