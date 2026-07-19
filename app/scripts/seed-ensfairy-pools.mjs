// Seeds the ENSFairy pools on a local fork by submitting the precomputed
// payloads from ensfairy-seed.json (see precompute-ensfairy-seed.mjs):
// node scripts/seed-ensfairy-pools.mjs <rpcUrl> <factoryAddress>
// Prints APPRAISED=<address> and ALL=<address> for the caller to capture.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createTestClient, http, parseAbi, parseEventLogs, publicActions, walletActions } from "viem";

const [rpcUrl, factoryAddress] = process.argv.slice(2);

if (!rpcUrl || !factoryAddress) throw new Error("usage: seed-ensfairy-pools.mjs <rpcUrl> <factoryAddress>");

const testAccount = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

const factoryEventAbi = parseAbi([
  "event PoolCreated(address indexed pool, address indexed poolOwner)",
]);

const poolReadAbi = parseAbi([
  "function getLabels() view returns (string[])",
]);

const seed = JSON.parse(readFileSync(fileURLToPath(new URL("ensfairy-seed.json", import.meta.url)), "utf8"));

if (!Array.isArray(seed.pools)) throw new Error("Malformed ensfairy-seed.json — run scripts/precompute-ensfairy-seed.mjs");

// The target may be a `just fork` anvil (chain id 31337) or a plain mainnet
// fork (chain id 1) — skip viem's declared-chain assertion and let the node
// decide.
const client = createTestClient({ mode: "anvil", transport: http(rpcUrl, { timeout: 60_000 }) })
  .extend(publicActions)
  .extend(walletActions);

const submit = async (to, data) => {
  // viem requires a literal null (not undefined) to skip its declared-chain
  // assertion — the fork answers as 31337 or 1 depending on how it was started.
  // eslint-disable-next-line unicorn/no-null
  const hash = await client.sendTransaction({ account: testAccount, chain: null, data, to });

  await client.waitForTransactionReceipt({ hash });

  return hash;
};

const seedPool = async (poolSeed) => {
  const createHash = await submit(factoryAddress, seed.createPoolData);
  const receipt = await client.getTransactionReceipt({ hash: createHash });
  const created = parseEventLogs({ abi: factoryEventAbi, eventName: "PoolCreated", logs: receipt.logs }).at(0);

  if (!created) throw new Error("PoolCreated event missing");

  const pool = created.args.pool;

  await submit(pool, seed.configurePoolData);

  for (const batch of poolSeed.updateBatches) {
    await submit(pool, batch);
  }

  const stored = await client.readContract({ abi: poolReadAbi, address: pool, functionName: "getLabels" });

  if (stored.length !== poolSeed.labelCount) {
    throw new Error(`Pool ${pool} stored ${stored.length}/${poolSeed.labelCount} labels`);
  }

  return pool;
};

for (const poolSeed of seed.pools) {
  const pool = await seedPool(poolSeed);

  console.log(`${poolSeed.key.toUpperCase()}=${pool}`);
}
