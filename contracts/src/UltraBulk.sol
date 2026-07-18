// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IETHRegistrarController} from "./interfaces/IENSV1.sol";

contract UltraBulk {
    struct PriceGroup {
        string[] names;
        uint256 duration;
        uint256 price;
    }

    error InsufficientBalance();
    error UnexpectedEthPrice(string name, uint256 expected, uint256 actual);

    address public owner;
    IETHRegistrarController public immutable ethController;

    constructor(IETHRegistrarController ethController_) {
        owner = msg.sender;
        ethController = ethController_;
    }

    function renewAll(string[] calldata names, uint256 duration, uint256 price) external payable {
        uint256 length = names.length;
        uint256 total = price * length;
        if (msg.value <= total) revert InsufficientBalance();

        for (uint256 i; i < length;) {
            ethController.renew{value: price}(names[i], duration);
            unchecked {
                ++i;
            }
        }
    }

    function renewByPriceGroups(PriceGroup[] calldata groups) external payable {
        uint256 total = _checkEthPrices(groups);
        if (msg.value != total) revert InsufficientBalance();

        for (uint256 i; i < groups.length;) {
            PriceGroup calldata group = groups[i];
            for (uint256 j; j < group.names.length;) {
                ethController.renew{value: group.price}(group.names[j], group.duration);
                unchecked {
                    ++j;
                }
            }
            unchecked {
                ++i;
            }
        }
    }

    function refund() external payable {
        (bool success,) = owner.call{value: address(this).balance}("");
        if (!success) revert InsufficientBalance();
    }

    receive() external payable {}

    fallback() external payable {}

    function _checkEthPrices(PriceGroup[] calldata groups) private view returns (uint256 total) {
        for (uint256 i; i < groups.length;) {
            PriceGroup calldata group = groups[i];
            for (uint256 j; j < group.names.length;) {
                uint256 actual = ethController.rentPrice(group.names[j], group.duration);
                if (actual != group.price) {
                    revert UnexpectedEthPrice(group.names[j], group.price, actual);
                }
                total += group.price;
                unchecked {
                    ++j;
                }
            }
            unchecked {
                ++i;
            }
        }
    }
}
