# ENS Pools & UltraBulk

This folder contains ETH-only ENSv1 renewal contracts.

## UltraBulk

UltraBulk batches ENSv1 `.eth` renewals using ETH. It supports same-price batches and price-group batches. It has no ERC-20 or ENSv2 payment logic.

Any ETH above the quoted price in `renewAll` remains in the contract as a protocol donation. `renewByPriceGroups` requires the exact total quoted price.

## ENS Pools

This is a new construct within the ethereum ecosystem.
Think of it like a vault for ENS names, a bounty list of sorts.
Anyone can create a pool (which gets its own address), and configure the pool with a list of (.eth) names, and renewal parameters.
After topping up the pool with ETH, it can be used to renew configured names.

When a name is within the pool's criteria for renewal, anyone querying the protocol for "opportunities" (we should be able to make this easy using a solidity view call) will be able to see the names and arbitrage / relay the renewal.
They craft and submit a valid payload to the protocol, providing a list of pools, names per pool, and pricing info. The pool validates expiry criteria and the factory forwards only renewal calls. The protocol contract ensures that pools pay the appropriate fees and relayers receive their configured rewards.

The owner can withdraw funds from a pool any time.
The owner should also be able to pay from a pool for a batch of non-associated renewals directly.

### Planned Modules And Adapters

Adapters and ENSv2 support are intentionally not part of the current V1 execution path.

Renewal modules are factory-allowlisted and explicitly enabled by each pool owner. A module is invoked through the pool, which exposes only scoped actions. The current `ENSv1RenewalModule` can request the pool's validated V1 renewal action, but cannot receive arbitrary transfer or call authority.

The planned ENSv1 module will add pool-owned adapter routes, such as `xUSDC -> USDC -> ETH`, before calling UltraBulk.

The planned ENSv2 module will execute routes to an ENSv2-accepted ERC-20, then call the ENSv2 renewer directly. ENSv2 token payment and batching logic will remain outside UltraBulk.

## Benchmarks
