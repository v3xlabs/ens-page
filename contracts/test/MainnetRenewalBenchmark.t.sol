// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {RenewalPool} from "../src/RenewalPool.sol";
import {RenewalPoolFactory} from "../src/RenewalPoolFactory.sol";
import {UltraBulk} from "../src/UltraBulk.sol";
import {IBaseRegistrar, IETHRegistrarController} from "../src/interfaces/IENSV1.sol";

interface Vm {
    function createSelectFork(string calldata urlOrAlias, uint256 blockNumber) external returns (uint256 forkId);

    function deal(address account, uint256 newBalance) external;

    function envOr(string calldata name, string calldata defaultValue) external returns (string memory value);

    function envString(string calldata name) external returns (string memory value);

    function envUint(string calldata name) external returns (uint256 value);

    function txGasPrice(uint256 newGasPrice) external;
}

contract MainnetRenewalBenchmarkTest {
    address private constant ETH_CONTROLLER = 0x283Af0B28c62C092C9727F1Ee09c02CA627EB7F5;
    address private constant BASE_REGISTRAR = 0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85;
    uint256 private constant DURATION = 365 days;
    uint256 private constant TX_GAS_PRICE = 1 gwei;
    uint256 private constant REWARD_CAP = 0.01 ether;
    uint256 private constant PREMIUM = 0.001 ether;

    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    error LabelsMustDiffer(string first, string second);
    error LabelNotActive(string label, uint256 expiry, uint256 timestamp);
    error LabelHasNoRenewalPrice(string label, uint256 price);
    error ExpectedSamePrice(string first, uint256 firstPrice, string second, uint256 secondPrice);
    error ExpectedDifferentPrices(string first, uint256 firstPrice, string second, uint256 secondPrice);
    error ExpectedLabelCount(uint256 expected, uint256 actual);
    error ExpectedLabelLength(string label, uint256 expected, uint256 actual);
    error ExpectedUniformPrice(string label, uint256 expected, uint256 actual);
    error RenewalDidNotExtend(string label, uint256 expiryBefore, uint256 expiryAfter);
    error RewardNotPaid(uint256 actual);

    struct BenchmarkMetrics {
        uint256 measuredGas;
        uint256 fundedValue;
        uint256 ensSpend;
        uint256 ultraBulkDonation;
        uint256 ultraBulkRefund;
        uint256 relayerReward;
        uint256 nameCount;
        uint256 averageFundedPricePerName;
        uint256 averageEnsSpendPerName;
        uint256 averageGasPerName;
    }

    event RenewalBenchmark(
        string scenario, BenchmarkMetrics metrics, bool hasUniformQuotedPrice, uint256 quotedPricePerName, string labels
    );

    IETHRegistrarController private controller;
    IBaseRegistrar private baseRegistrar;
    UltraBulk private ultraBulk;
    RenewalPoolFactory private factory;
    string private samePriceLabelA;
    string private samePriceLabelB;
    string private differentPriceLabel;
    uint256 private samePriceA;
    uint256 private samePriceB;
    uint256 private differentPrice;

    receive() external payable {}

    function setUp() public {
        vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), vm.envUint("MAINNET_FORK_BLOCK"));
        vm.txGasPrice(TX_GAS_PRICE);

        samePriceLabelA = vm.envOr("MAINNET_RENEWAL_LABEL_SAME_A", "vitalik");
        samePriceLabelB = vm.envOr("MAINNET_RENEWAL_LABEL_SAME_B", "ethereum");
        differentPriceLabel = vm.envOr("MAINNET_RENEWAL_LABEL_DIFFERENT", "ens");

        controller = IETHRegistrarController(ETH_CONTROLLER);
        baseRegistrar = IBaseRegistrar(BASE_REGISTRAR);
        ultraBulk = new UltraBulk(controller);
        factory = new RenewalPoolFactory(address(this));
        factory.setProtocolContracts(ultraBulk, baseRegistrar);

        _validateLabels();
    }

    function test_BenchmarkDirectControllerRenewal() public {
        uint256 expiryBefore = _expiry(samePriceLabelA);
        vm.deal(address(this), samePriceA);

        uint256 gasStart = gasleft();
        controller.renew{value: samePriceA}(samePriceLabelA, DURATION);
        uint256 measuredGas = gasStart - gasleft();

        _assertExtended(samePriceLabelA, expiryBefore);
        _emit(
            "v1-direct-controller",
            _metrics(measuredGas, samePriceA, samePriceA, 0, 0, 0, 1),
            true,
            samePriceA,
            samePriceLabelA
        );
    }

    function test_BenchmarkUltraBulkRenewAllSamePrice() public {
        string[] memory labels = new string[](2);
        labels[0] = samePriceLabelA;
        labels[1] = samePriceLabelB;
        _benchmarkRenewAll("v1-ultrabulk-renewAll-two-same-price-plus-one-wei", labels, samePriceA);
    }

    function test_BenchmarkUltraBulkRenewAllTwentyFiveCharacterLabels() public {
        string[] memory labels = _fiveCharacterLabels();
        uint256 price = _validateUniformBatch(labels, 20, 5);
        _benchmarkRenewAll("v1-ultrabulk-renewAll-twenty-five-character-plus-one-wei", labels, price);
    }

    function test_BenchmarkUltraBulkRenewAllTenThreeCharacterLabels() public {
        string[] memory labels = _threeCharacterLabels();
        uint256 price = _validateUniformBatch(labels, 10, 3);
        _benchmarkRenewAll("v1-ultrabulk-renewAll-ten-three-character-plus-one-wei", labels, price);
    }

    function test_BenchmarkUltraBulkRenewByPriceGroups() public {
        UltraBulk.PriceGroup[] memory groups = _differentPriceGroups();
        uint256 fundedValue = samePriceA + differentPrice;
        uint256 expiryBefore = _expiry(samePriceLabelA);
        uint256 ultraBulkBalanceBefore = address(ultraBulk).balance;
        vm.deal(address(this), fundedValue);

        uint256 gasStart = gasleft();
        ultraBulk.renewByPriceGroups{value: fundedValue}(groups);
        uint256 measuredGas = gasStart - gasleft();
        uint256 ultraBulkDonation = address(ultraBulk).balance - ultraBulkBalanceBefore;

        _assertExtended(samePriceLabelA, expiryBefore);
        _emit(
            "v1-ultrabulk-renewByPriceGroups-two-different-price-groups",
            _metrics(measuredGas, fundedValue, fundedValue - ultraBulkDonation, ultraBulkDonation, 0, 0, 2),
            false,
            0,
            string.concat(samePriceLabelA, ",", differentPriceLabel)
        );
    }

    function test_BenchmarkRenewalPoolRenew() public {
        RenewalPool pool = _createPool(samePriceLabelA);
        UltraBulk.PriceGroup[] memory groups = _singlePriceGroup(samePriceLabelA, samePriceA);
        uint256 expiryBefore = _expiry(samePriceLabelA);
        uint256 relayerBalanceBefore = address(this).balance;
        uint256 ultraBulkBalanceBefore = address(ultraBulk).balance;

        uint256 gasStart = gasleft();
        pool.renew(groups);
        uint256 measuredGas = gasStart - gasleft();
        uint256 relayerReward = address(this).balance - relayerBalanceBefore;

        _assertExtended(samePriceLabelA, expiryBefore);
        if (relayerReward < PREMIUM) revert RewardNotPaid(relayerReward);
        uint256 ultraBulkDonation = address(ultraBulk).balance - ultraBulkBalanceBefore;
        _emit(
            "v1-renewal-pool-renew-one-name",
            _metrics(measuredGas, samePriceA, samePriceA - ultraBulkDonation, ultraBulkDonation, 0, relayerReward, 1),
            true,
            samePriceA,
            samePriceLabelA
        );
    }

    function test_BenchmarkFactoryExecuteTwoPools() public {
        RenewalPool firstPool = _createPool(samePriceLabelA);
        RenewalPool secondPool = _createPool(differentPriceLabel);
        UltraBulk.PriceGroup[] memory firstGroups = _singlePriceGroup(samePriceLabelA, samePriceA);
        UltraBulk.PriceGroup[] memory secondGroups = _singlePriceGroup(differentPriceLabel, differentPrice);
        address[] memory pools = new address[](2);
        pools[0] = address(firstPool);
        pools[1] = address(secondPool);
        bytes[] memory calls = new bytes[](2);
        calls[0] = abi.encodeWithSelector(RenewalPool.renew.selector, firstGroups);
        calls[1] = abi.encodeWithSelector(RenewalPool.renew.selector, secondGroups);
        uint256 expiryBefore = _expiry(samePriceLabelA);
        uint256 relayerBalanceBefore = address(this).balance;
        uint256 ultraBulkBalanceBefore = address(ultraBulk).balance;

        uint256 gasStart = gasleft();
        factory.execute(pools, calls);
        uint256 measuredGas = gasStart - gasleft();
        uint256 relayerReward = address(this).balance - relayerBalanceBefore;

        _assertExtended(samePriceLabelA, expiryBefore);
        if (relayerReward < PREMIUM * 2) revert RewardNotPaid(relayerReward);
        uint256 fundedValue = samePriceA + differentPrice;
        uint256 ultraBulkDonation = address(ultraBulk).balance - ultraBulkBalanceBefore;
        _emit(
            "v1-factory-execute-two-pools",
            _metrics(measuredGas, fundedValue, fundedValue - ultraBulkDonation, ultraBulkDonation, 0, relayerReward, 2),
            false,
            0,
            string.concat(samePriceLabelA, ",", differentPriceLabel)
        );
    }

    function _validateLabels() private {
        _requireDifferent(samePriceLabelA, samePriceLabelB);
        _requireDifferent(samePriceLabelA, differentPriceLabel);
        _requireDifferent(samePriceLabelB, differentPriceLabel);
        _validateActive(samePriceLabelA);
        _validateActive(samePriceLabelB);
        _validateActive(differentPriceLabel);

        samePriceA = controller.rentPrice(samePriceLabelA, DURATION);
        samePriceB = controller.rentPrice(samePriceLabelB, DURATION);
        differentPrice = controller.rentPrice(differentPriceLabel, DURATION);
        if (samePriceA == 0) revert LabelHasNoRenewalPrice(samePriceLabelA, samePriceA);
        if (samePriceB == 0) revert LabelHasNoRenewalPrice(samePriceLabelB, samePriceB);
        if (differentPrice == 0) revert LabelHasNoRenewalPrice(differentPriceLabel, differentPrice);
        if (samePriceA != samePriceB) {
            revert ExpectedSamePrice(samePriceLabelA, samePriceA, samePriceLabelB, samePriceB);
        }
        if (samePriceA == differentPrice) {
            revert ExpectedDifferentPrices(samePriceLabelA, samePriceA, differentPriceLabel, differentPrice);
        }
    }

    function _benchmarkRenewAll(string memory scenario, string[] memory labels, uint256 price) private {
        BenchmarkMetrics memory metrics;
        metrics.nameCount = labels.length;
        metrics.ensSpend = price * metrics.nameCount;
        metrics.fundedValue = metrics.ensSpend + 1;
        uint256[] memory expiriesBefore = _expiries(labels);
        uint256 ultraBulkBalanceBefore = address(ultraBulk).balance;
        vm.deal(address(this), metrics.fundedValue);

        uint256 gasStart = gasleft();
        ultraBulk.renewAll{value: metrics.fundedValue}(labels, DURATION, price);
        metrics.measuredGas = gasStart - gasleft();
        metrics.ultraBulkDonation = address(ultraBulk).balance - ultraBulkBalanceBefore;
        metrics.ultraBulkRefund = metrics.fundedValue - metrics.ensSpend - metrics.ultraBulkDonation;
        metrics.averageFundedPricePerName = metrics.fundedValue / metrics.nameCount;
        metrics.averageEnsSpendPerName = metrics.ensSpend / metrics.nameCount;
        metrics.averageGasPerName = metrics.measuredGas / metrics.nameCount;

        _assertAllExtended(labels, expiriesBefore);
        _emit(scenario, metrics, true, price, _join(labels));
    }

    function _fiveCharacterLabels() private returns (string[] memory labels) {
        string memory candidates = vm.envOr("MAINNET_RENEWAL_FIVE_CHARACTER_LABELS", "");
        if (bytes(candidates).length != 0) return _parseLabels(candidates);

        labels = new string[](20);
        labels[0] = "apple";
        labels[1] = "tesla";
        labels[2] = "steam";
        labels[3] = "slack";
        labels[4] = "maker";
        labels[5] = "curve";
        labels[6] = "ether";
        labels[7] = "chain";
        labels[8] = "token";
        labels[9] = "honda";
        labels[10] = "yahoo";
        labels[11] = "skype";
        labels[12] = "adobe";
        labels[13] = "intel";
        labels[14] = "nokia";
        labels[15] = "canon";
        labels[16] = "linux";
        labels[17] = "opera";
        labels[18] = "anime";
        labels[19] = "music";
    }

    function _threeCharacterLabels() private returns (string[] memory labels) {
        string memory candidates = vm.envOr("MAINNET_RENEWAL_THREE_CHARACTER_LABELS", "");
        if (bytes(candidates).length != 0) return _parseLabels(candidates);

        labels = new string[](10);
        labels[0] = "eth";
        labels[1] = "ens";
        labels[2] = "nft";
        labels[3] = "dao";
        labels[4] = "web";
        labels[5] = "btc";
        labels[6] = "bnb";
        labels[7] = "sol";
        labels[8] = "ape";
        labels[9] = "uni";
    }

    function _parseLabels(string memory candidates) private pure returns (string[] memory labels) {
        bytes memory input = bytes(candidates);
        uint256 count = 1;
        for (uint256 i; i < input.length;) {
            if (input[i] == ",") ++count;
            unchecked {
                ++i;
            }
        }

        labels = new string[](count);
        uint256 start;
        uint256 labelIndex;
        for (uint256 i; i <= input.length;) {
            if (i == input.length || input[i] == ",") {
                bytes memory label = new bytes(i - start);
                for (uint256 j; j < label.length;) {
                    label[j] = input[start + j];
                    unchecked {
                        ++j;
                    }
                }
                labels[labelIndex] = string(label);
                ++labelIndex;
                start = i + 1;
            }
            unchecked {
                ++i;
            }
        }
    }

    function _validateUniformBatch(string[] memory labels, uint256 expectedCount, uint256 expectedLength)
        private
        view
        returns (uint256 price)
    {
        if (labels.length != expectedCount) revert ExpectedLabelCount(expectedCount, labels.length);

        for (uint256 i; i < labels.length;) {
            string memory label = labels[i];
            uint256 length = bytes(label).length;
            if (length != expectedLength) revert ExpectedLabelLength(label, expectedLength, length);
            _validateActive(label);
            uint256 actualPrice = controller.rentPrice(label, DURATION);
            if (actualPrice == 0) revert LabelHasNoRenewalPrice(label, actualPrice);
            if (i == 0) {
                price = actualPrice;
            } else if (actualPrice != price) {
                revert ExpectedUniformPrice(label, price, actualPrice);
            }
            for (uint256 j; j < i;) {
                _requireDifferent(label, labels[j]);
                unchecked {
                    ++j;
                }
            }
            unchecked {
                ++i;
            }
        }
    }

    function _createPool(string memory label) private returns (RenewalPool pool) {
        factory.setDurationAllowed(DURATION, true);
        pool = factory.createPool(address(this));
        pool.configureLabel(label, uint64(DURATION), type(uint64).max);
        pool.configureReward(TX_GAS_PRICE, REWARD_CAP, PREMIUM);
        vm.deal(address(pool), controller.rentPrice(label, DURATION) + REWARD_CAP + PREMIUM);
    }

    function _differentPriceGroups() private view returns (UltraBulk.PriceGroup[] memory groups) {
        groups = new UltraBulk.PriceGroup[](2);
        groups[0] = _group(samePriceLabelA, samePriceA);
        groups[1] = _group(differentPriceLabel, differentPrice);
    }

    function _singlePriceGroup(string memory label, uint256 price)
        private
        pure
        returns (UltraBulk.PriceGroup[] memory groups)
    {
        groups = new UltraBulk.PriceGroup[](1);
        groups[0] = _group(label, price);
    }

    function _group(string memory label, uint256 price) private pure returns (UltraBulk.PriceGroup memory group) {
        group.names = new string[](1);
        group.names[0] = label;
        group.duration = DURATION;
        group.price = price;
    }

    function _validateActive(string memory label) private view {
        uint256 expiry = _expiry(label);
        if (expiry <= block.timestamp) revert LabelNotActive(label, expiry, block.timestamp);
    }

    function _assertExtended(string memory label, uint256 expiryBefore) private view {
        uint256 expiryAfter = _expiry(label);
        if (expiryAfter <= expiryBefore) revert RenewalDidNotExtend(label, expiryBefore, expiryAfter);
    }

    function _expiries(string[] memory labels) private view returns (uint256[] memory expiries) {
        expiries = new uint256[](labels.length);
        for (uint256 i; i < labels.length;) {
            expiries[i] = _expiry(labels[i]);
            unchecked {
                ++i;
            }
        }
    }

    function _assertAllExtended(string[] memory labels, uint256[] memory expiriesBefore) private view {
        for (uint256 i; i < labels.length;) {
            _assertExtended(labels[i], expiriesBefore[i]);
            unchecked {
                ++i;
            }
        }
    }

    function _expiry(string memory label) private view returns (uint256) {
        return baseRegistrar.nameExpires(uint256(keccak256(bytes(label))));
    }

    function _requireDifferent(string memory first, string memory second) private pure {
        if (keccak256(bytes(first)) == keccak256(bytes(second))) revert LabelsMustDiffer(first, second);
    }

    function _join(string[] memory labels) private pure returns (string memory joined) {
        for (uint256 i; i < labels.length;) {
            if (i == 0) {
                joined = labels[i];
            } else {
                joined = string.concat(joined, ",", labels[i]);
            }
            unchecked {
                ++i;
            }
        }
    }

    function _emit(
        string memory scenario,
        BenchmarkMetrics memory metrics,
        bool hasUniformQuotedPrice,
        uint256 quotedPricePerName,
        string memory labels
    ) private {
        emit RenewalBenchmark(scenario, metrics, hasUniformQuotedPrice, quotedPricePerName, labels);
    }

    function _metrics(
        uint256 measuredGas,
        uint256 fundedValue,
        uint256 ensSpend,
        uint256 ultraBulkDonation,
        uint256 ultraBulkRefund,
        uint256 relayerReward,
        uint256 nameCount
    ) private pure returns (BenchmarkMetrics memory metrics) {
        metrics = BenchmarkMetrics({
            measuredGas: measuredGas,
            fundedValue: fundedValue,
            ensSpend: ensSpend,
            ultraBulkDonation: ultraBulkDonation,
            ultraBulkRefund: ultraBulkRefund,
            relayerReward: relayerReward,
            nameCount: nameCount,
            averageFundedPricePerName: fundedValue / nameCount,
            averageEnsSpendPerName: ensSpend / nameCount,
            averageGasPerName: measuredGas / nameCount
        });
    }
}
