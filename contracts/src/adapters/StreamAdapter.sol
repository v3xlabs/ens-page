// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {IPoolAdapter} from "../interfaces/IPoolAdapter.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";

/// @notice Escrowed streams that vest ETH or ERC20 deposits into a pool over time.
///
/// Anyone may open a stream toward any pool and anyone may push the accrued
/// portion onward with `claim` — claiming is the stream's "pre-op" before a
/// renewal. Cancelling pays out what has vested and refunds the rest to the
/// payer. Implements `IPoolAdapter` for discovery/enable gating only; it is
/// not a conversion step, so `execute` always reverts.
contract StreamAdapter is IPoolAdapter {
    struct Stream {
        address payer;
        address pool;
        address token;
        uint64 startTime;
        uint64 stopTime;
        uint256 totalAmount;
        uint256 claimed;
    }

    error InvalidStream();
    error NotStreamPayer(uint256 streamId);
    error NotARouteStep();

    event StreamCreated(
        uint256 indexed streamId,
        address indexed pool,
        address indexed payer,
        address token,
        uint256 totalAmount,
        uint64 startTime,
        uint64 stopTime
    );
    event StreamClaimed(uint256 indexed streamId, uint256 amount);
    event StreamCancelled(uint256 indexed streamId, uint256 refund);

    uint256 public streamCount;
    mapping(uint256 streamId => Stream stream) private streams;
    mapping(address pool => uint256[] streamIds) private poolStreamIds;

    function adapterType() external pure returns (string memory) {
        return "stream";
    }

    /// @dev Streams are not token-conversion steps; configuring this adapter
    /// into a route is a misconfiguration and reverts the route atomically.
    function execute(address, address, uint256, bytes calldata) external pure returns (address, uint256) {
        revert NotARouteStep();
    }

    function createEthStream(address pool, uint64 durationSeconds) external payable returns (uint256 streamId) {
        return _createStream(pool, address(0), msg.value, durationSeconds);
    }

    function createTokenStream(address pool, address token, uint256 amount, uint64 durationSeconds)
        external
        returns (uint256 streamId)
    {
        if (token == address(0)) revert InvalidStream();
        SafeTransferLib.safeTransferFrom(token, msg.sender, address(this), amount);
        return _createStream(pool, token, amount, durationSeconds);
    }

    function _createStream(address pool, address token, uint256 amount, uint64 durationSeconds)
        private
        returns (uint256 streamId)
    {
        if (pool == address(0) || amount == 0 || durationSeconds == 0) revert InvalidStream();
        streamId = ++streamCount;
        uint64 startTime = uint64(block.timestamp);
        uint64 stopTime = startTime + durationSeconds;
        streams[streamId] = Stream({
            payer: msg.sender,
            pool: pool,
            token: token,
            startTime: startTime,
            stopTime: stopTime,
            totalAmount: amount,
            claimed: 0
        });
        poolStreamIds[pool].push(streamId);
        emit StreamCreated(streamId, pool, msg.sender, token, amount, startTime, stopTime);
    }

    /// @notice Pushes everything vested but not yet claimed onward to the pool.
    function claim(uint256 streamId) external returns (uint256 amount) {
        Stream storage stream = streams[streamId];
        if (stream.pool == address(0)) revert InvalidStream();
        amount = _vestedAmount(stream) - stream.claimed;
        if (amount == 0) return 0;
        stream.claimed += amount;
        _payOut(stream.token, stream.pool, amount);
        emit StreamClaimed(streamId, amount);
    }

    function cancel(uint256 streamId) external returns (uint256 refund) {
        Stream storage stream = streams[streamId];
        if (stream.pool == address(0)) revert InvalidStream();
        if (stream.payer != msg.sender) revert NotStreamPayer(streamId);
        uint256 vested = _vestedAmount(stream);
        uint256 toPool = vested - stream.claimed;
        refund = stream.totalAmount - vested;
        stream.claimed = vested;
        stream.totalAmount = vested;
        stream.stopTime = uint64(block.timestamp);
        if (toPool > 0) _payOut(stream.token, stream.pool, toPool);
        if (refund > 0) _payOut(stream.token, stream.payer, refund);
        emit StreamCancelled(streamId, refund);
    }

    function accruedOf(uint256 streamId) external view returns (uint256) {
        Stream storage stream = streams[streamId];
        if (stream.pool == address(0)) return 0;
        return _vestedAmount(stream) - stream.claimed;
    }

    function getStream(uint256 streamId) external view returns (Stream memory) {
        return streams[streamId];
    }

    function getPoolStreams(address pool) external view returns (uint256[] memory streamIds, Stream[] memory result) {
        streamIds = poolStreamIds[pool];
        result = new Stream[](streamIds.length);
        for (uint256 i; i < streamIds.length; ++i) {
            result[i] = streams[streamIds[i]];
        }
    }

    function _vestedAmount(Stream storage stream) private view returns (uint256) {
        if (block.timestamp >= stream.stopTime) return stream.totalAmount;
        uint256 elapsed = block.timestamp - stream.startTime;
        return (stream.totalAmount * elapsed) / (stream.stopTime - stream.startTime);
    }

    function _payOut(address token, address recipient, uint256 amount) private {
        if (token == address(0)) {
            SafeTransferLib.safeTransferETH(recipient, amount);
        } else {
            SafeTransferLib.safeTransfer(token, recipient, amount);
        }
    }
}
