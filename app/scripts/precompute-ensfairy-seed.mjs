// Precomputes every transaction payload needed to seed the ENSFairy pools so
// fork/test seeding is pure submission — no per-run ABI encoding. Reads
// ensfairy-names.json + ensfairy-appraisals.json, writes ensfairy-seed.json.
// Rerun after refreshing either input: node scripts/precompute-ensfairy-seed.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { encodeFunctionData, parseAbi } from "viem";

const TEST_ACCOUNT = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const LABELS_PER_BATCH = 100;

const factoryAbi = parseAbi([
  "function createPool(address poolOwner) returns (address pool)",
]);

const poolAbi = parseAbi([
  "function configurePool(uint64 duration, uint64 threshold, uint256 gasPriceCap, uint256 rewardCap, uint256 premium)",
  "function updateLabels(string[] additions, string[] removals)",
]);

const readJson = relativePath => JSON.parse(readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8"));

const names = readJson("ensfairy-names.json");
const appraisals = readJson("ensfairy-appraisals.json");

if (!Array.isArray(names.all)) throw new Error("Malformed ensfairy-names.json");

if (!Array.isArray(appraisals.names)) throw new Error("Malformed ensfairy-appraisals.json");

const appraisedLabels = appraisals.names.map(({ name }) => {
  if (typeof name !== "string" || !name.endsWith(".eth")) {
    throw new Error("Malformed ensfairy-appraisals.json: each name must end in .eth");
  }

  return name.slice(0, -4);
});

const encodeBatches = (labels) => {
  const batches = [];

  for (let index = 0; index < labels.length; index += LABELS_PER_BATCH) {
    batches.push(encodeFunctionData({
      abi: poolAbi,
      args: [labels.slice(index, index + LABELS_PER_BATCH), []],
      functionName: "updateLabels",
    }));
  }

  return batches;
};

const output = {
  createPoolData: encodeFunctionData({ abi: factoryAbi, args: [TEST_ACCOUNT], functionName: "createPool" }),
  configurePoolData: encodeFunctionData({
    abi: poolAbi,
    args: [31_536_000n, 2_592_000n, 15_000_000_000n, 0n, 0n],
    functionName: "configurePool",
  }),
  generatedAt: new Date().toISOString(),
  pools: [
    { key: "appraised", label: "ensfairy appraised", labelCount: appraisedLabels.length, updateBatches: encodeBatches(appraisedLabels) },
    { key: "all", label: "ensfairy all", labelCount: names.all.length, updateBatches: encodeBatches(names.all) },
  ],
};

writeFileSync(
  fileURLToPath(new URL("ensfairy-seed.json", import.meta.url)),
  `${JSON.stringify(output, undefined, 2)}\n`,
);

console.log(`Encoded ${output.pools.map(pool => `${pool.key}: ${pool.labelCount} labels / ${pool.updateBatches.length} txs`).join(", ")}`);
