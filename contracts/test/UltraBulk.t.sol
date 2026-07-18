// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {UltraBulk} from "../src/UltraBulk.sol";
import {IETHRegistrarController} from "../src/interfaces/IENSV1.sol";

contract MockEthController is IETHRegistrarController {
    mapping(bytes32 labelHash => uint256 price) public prices;
    mapping(bytes32 labelHash => uint256 renewals) public renewals;

    function setPrice(string calldata name, uint256 price) external {
        prices[keccak256(bytes(name))] = price;
    }

    function rentPrice(string calldata name, uint256) external view returns (uint256) {
        return prices[keccak256(bytes(name))];
    }

    function renew(string calldata name, uint256) external payable {
        require(msg.value == prices[keccak256(bytes(name))], "price");
        ++renewals[keccak256(bytes(name))];
    }
}

contract UltraBulkTest {
    function test_RenewByPriceGroups() public {
        MockEthController controller = new MockEthController();
        UltraBulk bulk = new UltraBulk(controller);
        controller.setPrice("alpha", 2 ether);
        controller.setPrice("beta", 1 ether);

        UltraBulk.PriceGroup[] memory groups = new UltraBulk.PriceGroup[](2);
        groups[0].names = new string[](1);
        groups[0].names[0] = "alpha";
        groups[0].duration = 365 days;
        groups[0].price = 2 ether;
        groups[1].names = new string[](1);
        groups[1].names[0] = "beta";
        groups[1].duration = 30 days;
        groups[1].price = 1 ether;

        bulk.renewByPriceGroups{value: 3 ether}(groups);

        require(controller.renewals(keccak256("alpha")) == 1, "alpha was not renewed");
        require(controller.renewals(keccak256("beta")) == 1, "beta was not renewed");
    }
}
