// Seeds the "ensfairy top 200" and "ensfairy all" pools on a local fork:
// node scripts/seed-ensfairy-pools.mjs <rpcUrl> <factoryAddress>
// Prints TOP200=<address> and ALL=<address> for the caller to capture.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createTestClient, http, parseAbi, parseEventLogs, publicActions, walletActions } from "viem";

const [rpcUrl, factoryAddress] = process.argv.slice(2);

if (!rpcUrl || !factoryAddress) throw new Error("usage: seed-ensfairy-pools.mjs <rpcUrl> <factoryAddress>");

const testAccount = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

const factoryAbi = parseAbi([
  "function createPool(address poolOwner) returns (address pool)",
  "event PoolCreated(address indexed pool, address indexed poolOwner)",
]);

const poolAbi = parseAbi([
  "function configurePool(uint64 duration, uint64 threshold, uint256 gasPriceCap, uint256 rewardCap, uint256 premium)",
  "function updateLabels(string[] additions, string[] removals)",
  "function getLabels() view returns (string[])",
]);

const names = JSON.parse(readFileSync(fileURLToPath(new URL("ensfairy-names.json", import.meta.url)), "utf8"));

// The target may be a `just fork` anvil (chain id 31337) or a plain mainnet
// fork (chain id 1) — skip viem's declared-chain assertion and let the node
// decide.
const client = createTestClient({ mode: "anvil", transport: http(rpcUrl, { timeout: 60_000 }) })
  .extend(publicActions)
  .extend(walletActions);

const send = async (request) => {
  const hash = await client.writeContract({ account: testAccount, chain: null, ...request });

  await client.waitForTransactionReceipt({ hash });

  return hash;
};

const createSeededPool = async (labels) => {
  const createHash = await send({ abi: factoryAbi, address: factoryAddress, args: [testAccount], functionName: "createPool" });
  const receipt = await client.getTransactionReceipt({ hash: createHash });
  const created = parseEventLogs({ abi: factoryAbi, eventName: "PoolCreated", logs: receipt.logs }).at(0);

  if (!created) throw new Error("PoolCreated event missing");

  const pool = created.args.pool;

  await send({
    abi: poolAbi,
    address: pool,
    args: [31_536_000n, 2_592_000n, 15_000_000_000n, 0n, 0n],
    functionName: "configurePool",
  });

  for (let index = 0; index < labels.length; index += 100) {
    await send({
      abi: poolAbi,
      address: pool,
      args: [labels.slice(index, index + 100), []],
      functionName: "updateLabels",
    });
  }

  const stored = await client.readContract({ abi: poolAbi, address: pool, functionName: "getLabels" });

  if (stored.length !== labels.length) throw new Error(`Pool ${pool} stored ${stored.length}/${labels.length} labels`);

  return pool;
};

const top200 = await createSeededPool(names.top200);
const all = await createSeededPool(names.all);

console.log(`TOP200=${top200}`);
console.log(`ALL=${all}`);
