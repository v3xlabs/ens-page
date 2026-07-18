// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {Counter} from "../src/Counter.sol";

contract CounterTest {
    function test_SetNumber() public {
        Counter counter = new Counter();
        counter.setNumber(42);

        require(counter.number() == 42, "number was not set");
    }

    function test_Increment() public {
        Counter counter = new Counter();
        counter.increment();

        require(counter.number() == 1, "number was not incremented");
    }
}
