// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {UltraBulk} from "./UltraBulk.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {IBaseRegistrar} from "./interfaces/IENSV1.sol";
import {IPoolAdapter} from "./interfaces/IPoolAdapter.sol";
import {IRenewalPoolFactory} from "./interfaces/IRenewalPoolFactory.sol";
import {IRenewalModule} from "./interfaces/IRenewalModule.sol";
import {Ownable} from "solady/auth/Ownable.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";
import {ReentrancyGuard} from "solady/utils/ReentrancyGuard.sol";
import {UUPSUpgradeable} from "solady/utils/UUPSUpgradeable.sol";
import {LibTransient} from "solady/utils/LibTransient.sol";

/// @notice A funded renewal account whose configured names may be renewed by anyone when due.
contract RenewalPool is Ownable, ReentrancyGuard, UUPSUpgradeable {
    struct LabelConfig {
        uint64 duration;
        uint64 threshold;
        bool configured;
    }

    /// @notice One conversion step of a token route. `data` is adapter-specific configuration.
    struct RouteStep {
        IPoolAdapter adapter;
        bytes data;
    }

    struct AdapterSetting {
        address adapter;
        bool enabled;
    }

    struct TokenRoute {
        address token;
        RouteStep[] steps;
    }

    error InvalidConfiguration();
    error EmptyPlan();
    error AdapterNotAllowed(address adapter);
    error AdapterNotEnabled(address adapter);
    error RouteNotConfigured(address token);
    error RouteOutputNotEth(address token);
    error ModuleNotAllowed(IRenewalModule module);
    error ModuleNotEnabled(IRenewalModule module);
    error LabelNotConfigured(string label);
    error IncorrectLabelConfiguration(string label);
    error DuplicateLabel(string label);
    error NameNotDue(string label, uint256 expiry, uint256 dueAt);
    error InsufficientRewardFunds(uint256 required, uint256 available);

    bytes32 private constant LABEL_SCOPE_SLOT = keccak256("renewal.pool.label.scope");
    bytes32 private constant ACTIVE_MODULE_SLOT = keccak256("renewal.pool.active.module");

    IRenewalPoolFactory public factory;
    uint256 public gasPriceCap;
    uint256 public rewardCap;
    uint256 public premium;
    uint64 public renewalDuration;
    uint64 public renewalThreshold;

    mapping(bytes32 labelHash => LabelConfig config) private labelConfigs;
    mapping(bytes32 labelHash => uint256 indexPlusOne) private labelIndexes;
    string[] private labels;
    mapping(address adapter => bool enabled) public isAdapterEnabled;
    mapping(IRenewalModule module => bool enabled) public isModuleEnabled;
    mapping(address token => RouteStep[] steps) private tokenRoutes;

    event TokenRouteConfigured(address indexed token, uint256 stepCount);
    event RouteExecuted(address indexed token, uint256 amountIn, uint256 ethOut);

    function initialize(address owner_, IRenewalPoolFactory factory_) external {
        if (msg.sender != address(factory_)) revert Unauthorized();
        if (owner_ == address(0)) revert InvalidConfiguration();
        _initializeOwner(owner_);
        factory = factory_;
    }

    function ultraBulk() public view returns (UltraBulk) {
        return factory.ultraBulk();
    }

    function baseRegistrar() public view returns (IBaseRegistrar) {
        return factory.baseRegistrar();
    }

    function _authorizeUpgrade(address newImplementation) internal view override {
        _checkOwner();
        if (!factory.isImplementationAllowed(newImplementation)) revert Unauthorized();
    }

    function _guardInitializeOwner() internal pure override returns (bool) {
        return true;
    }

    receive() external payable {}

    function configureLabel(string calldata label, uint64 duration, uint64 threshold) external onlyOwner {
        _setRenewalConfig(duration, threshold);
        _addLabel(label);
    }

    function updateLabels(string[] calldata additions, string[] calldata removals) external onlyOwner {
        for (uint256 i; i < removals.length; ++i) {
            _removeLabel(removals[i]);
        }
        for (uint256 i; i < additions.length; ++i) {
            _addLabel(additions[i]);
        }
    }

    function configurePool(
        uint64 duration,
        uint64 threshold,
        uint256 gasPriceCap_,
        uint256 rewardCap_,
        uint256 premium_
    ) external onlyOwner {
        _setRenewalConfig(duration, threshold);
        gasPriceCap = gasPriceCap_;
        rewardCap = rewardCap_;
        premium = premium_;
    }

    function _setRenewalConfig(uint64 duration, uint64 threshold) private {
        if (!factory.isDurationAllowed(duration)) revert InvalidConfiguration();
        renewalDuration = duration;
        renewalThreshold = threshold;
    }

    function _addLabel(string memory label) private {
        bytes32 labelHash = keccak256(bytes(label));
        if (!labelConfigs[labelHash].configured) {
            labels.push(label);
            labelIndexes[labelHash] = labels.length;
        }
        labelConfigs[labelHash] = LabelConfig(renewalDuration, renewalThreshold, true);
    }

    function removeLabel(string calldata label) external onlyOwner {
        _removeLabel(label);
    }

    function _removeLabel(string memory label) private {
        bytes32 labelHash = keccak256(bytes(label));
        uint256 indexPlusOne = labelIndexes[labelHash];
        if (indexPlusOne == 0) revert LabelNotConfigured(label);
        uint256 index = indexPlusOne - 1;
        uint256 lastIndex = labels.length - 1;
        if (index != lastIndex) {
            string memory lastLabel = labels[lastIndex];
            labels[index] = lastLabel;
            labelIndexes[keccak256(bytes(lastLabel))] = indexPlusOne;
        }
        labels.pop();
        delete labelIndexes[labelHash];
        delete labelConfigs[labelHash];
    }

    function configureReward(uint256 gasPriceCap_, uint256 rewardCap_, uint256 premium_) external onlyOwner {
        gasPriceCap = gasPriceCap_;
        rewardCap = rewardCap_;
        premium = premium_;
    }

    /// @notice The entire adapter surface — enablement and token routes — is
    /// reshaped through this one owner call, so any setup lands in a single
    /// transaction. An empty `steps` array clears a token's route. Step
    /// configuration (swap floors, target tokens) is owner-set, which is what
    /// makes `executeRoute` safe to leave permissionless.
    function configureAdapters(AdapterSetting[] calldata adapterSettings, TokenRoute[] calldata routes)
        external
        onlyOwner
    {
        for (uint256 i; i < adapterSettings.length; ++i) {
            AdapterSetting calldata setting = adapterSettings[i];
            if (setting.enabled && !factory.isAdapterAllowed(setting.adapter)) {
                revert AdapterNotAllowed(setting.adapter);
            }
            isAdapterEnabled[setting.adapter] = setting.enabled;
        }
        for (uint256 i; i < routes.length; ++i) {
            TokenRoute calldata route = routes[i];
            if (route.token == address(0)) revert InvalidConfiguration();
            delete tokenRoutes[route.token];
            for (uint256 j; j < route.steps.length; ++j) {
                address adapter = address(route.steps[j].adapter);
                if (!isAdapterEnabled[adapter]) revert AdapterNotEnabled(adapter);
                tokenRoutes[route.token].push(route.steps[j]);
            }
            emit TokenRouteConfigured(route.token, route.steps.length);
        }
    }

    function getTokenRoute(address token) external view returns (RouteStep[] memory) {
        return tokenRoutes[token];
    }

    /// @notice Converts `amountIn` of a deposited `token` into ETH held by the
    /// pool by walking the owner-configured route. Callable by anyone as the
    /// pre-op before a renewal.
    function executeRoute(address token, uint256 amountIn) external nonReentrant returns (uint256 ethOut) {
        return _executeRoute(token, amountIn);
    }

    /// @notice Runs a token route and renews in one transaction: the classic
    /// relayer flow of "convert, renew, get paid".
    function renewWithRoute(address token, uint256 amountIn, UltraBulk.PriceGroup[] calldata groups)
        external
        nonReentrant
    {
        _executeRoute(token, amountIn);
        _renew(groups);
    }

    function _executeRoute(address token, uint256 amountIn) private returns (uint256 ethOut) {
        RouteStep[] storage steps = tokenRoutes[token];
        if (steps.length == 0) revert RouteNotConfigured(token);
        uint256 balanceBefore = address(this).balance;
        address currentToken = token;
        uint256 currentAmount = amountIn;
        for (uint256 i; i < steps.length; ++i) {
            RouteStep storage step = steps[i];
            address adapter = address(step.adapter);
            if (!isAdapterEnabled[adapter] || !factory.isAdapterAllowed(adapter)) {
                revert AdapterNotEnabled(adapter);
            }
            SafeTransferLib.safeTransfer(currentToken, adapter, currentAmount);
            (currentToken, currentAmount) = step.adapter.execute(address(this), currentToken, currentAmount, step.data);
        }
        if (currentToken != address(0)) revert RouteOutputNotEth(currentToken);
        ethOut = address(this).balance - balanceBefore;
        emit RouteExecuted(token, amountIn, ethOut);
    }

    function setModuleEnabled(IRenewalModule module, bool enabled) external onlyOwner {
        if (enabled && !factory.isModuleAllowed(module)) revert ModuleNotAllowed(module);
        isModuleEnabled[module] = enabled;
    }

    function withdrawETH(address payable recipient, uint256 amount) external onlyOwner nonReentrant {
        SafeTransferLib.safeTransferETH(recipient, amount);
    }

    function withdrawToken(IERC20 token, address recipient, uint256 amount) external onlyOwner nonReentrant {
        SafeTransferLib.safeTransfer(address(token), recipient, amount);
    }

    function labelConfig(string calldata label) external view returns (LabelConfig memory) {
        return labelConfigs[keccak256(bytes(label))];
    }

    function getLabels() external view returns (string[] memory) {
        return labels;
    }

    function renew(UltraBulk.PriceGroup[] calldata groups) external nonReentrant {
        _renew(groups);
    }

    function executeModule(IRenewalModule module, bytes calldata data) external nonReentrant {
        if (!factory.isModuleAllowed(module)) revert ModuleNotAllowed(module);
        if (!isModuleEnabled[module]) revert ModuleNotEnabled(module);
        LibTransient.set(LibTransient.tUint256(ACTIVE_MODULE_SLOT), uint256(uint160(address(module))));
        (bool success, bytes memory result) = address(module).call(data);
        LibTransient.clear(LibTransient.tUint256(ACTIVE_MODULE_SLOT));
        if (!success) {
            assembly ("memory-safe") {
                revert(add(result, 0x20), mload(result))
            }
        }
    }

    function renewFromModule(UltraBulk.PriceGroup[] calldata groups) external {
        IRenewalModule module = IRenewalModule(msg.sender);
        if (LibTransient.get(LibTransient.tUint256(ACTIVE_MODULE_SLOT)) != uint256(uint160(msg.sender))) {
            revert ModuleNotEnabled(module);
        }
        _renew(groups);
    }

    function _renew(UltraBulk.PriceGroup[] calldata groups) private {
        uint256 gasStart = gasleft();
        uint256 total;
        uint256 nameCount;
        uint256 scope = _newLabelScope();
        for (uint256 i; i < groups.length; ++i) {
            UltraBulk.PriceGroup calldata group = groups[i];
            for (uint256 j; j < group.names.length; ++j) {
                _recordLabel(scope, group.names[j]);
                _validateEth(group.names[j], group.duration);
                total += group.price;
                unchecked {
                    ++nameCount;
                }
            }
        }
        if (nameCount == 0) revert EmptyPlan();
        ultraBulk().renewByPriceGroups{value: total}(groups);
        _payReward(gasStart);
    }

    function _validateEth(string calldata label, uint256 duration) private view {
        if (!labelConfigs[keccak256(bytes(label))].configured) revert LabelNotConfigured(label);
        if (renewalDuration != duration) revert IncorrectLabelConfiguration(label);
        uint256 expiry = baseRegistrar().nameExpires(uint256(keccak256(bytes(label))));
        uint256 dueAt = block.timestamp + renewalThreshold;
        if (expiry > dueAt) revert NameNotDue(label, expiry, dueAt);
    }

    function _payReward(uint256 gasStart) private {
        uint256 effectiveGasPrice = tx.gasprice < gasPriceCap ? tx.gasprice : gasPriceCap;
        uint256 gasReward = (gasStart - gasleft()) * effectiveGasPrice;
        if (gasReward > rewardCap) gasReward = rewardCap;
        uint256 reward = gasReward + premium;
        if (reward == 0) return;
        uint256 balance = address(this).balance;
        if (balance < reward) revert InsufficientRewardFunds(reward, balance);
        SafeTransferLib.safeTransferETH(msg.sender, reward);
    }

    function _newLabelScope() private returns (uint256) {
        return LibTransient.inc(LibTransient.tUint256(LABEL_SCOPE_SLOT));
    }

    function _recordLabel(uint256 scope, string calldata label) private {
        bytes32 labelSlot = keccak256(abi.encode(LABEL_SCOPE_SLOT, scope, keccak256(bytes(label))));
        LibTransient.TUint256 storage seen = LibTransient.tUint256(labelSlot);
        if (LibTransient.get(seen) != 0) revert DuplicateLabel(label);
        LibTransient.set(seen, 1);
    }
}
