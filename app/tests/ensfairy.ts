import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { type Address, parseAbi, parseEventLogs } from "viem";
import { mainnet } from "viem/chains";

import type { ForkClient } from "./anvil";
import { testAccountAddress } from "./ens";

export type EnsfairyPools = {
  all: Address;
  top200: Address;
};

const factorySeedAbi = parseAbi([
  "function createPool(address poolOwner) returns (address pool)",
  "event PoolCreated(address indexed pool, address indexed poolOwner)",
]);

const poolSeedAbi = parseAbi([
  "function configurePool(uint64 duration, uint64 threshold, uint256 gasPriceCap, uint256 rewardCap, uint256 premium)",
  "function updateLabels(string[] additions, string[] removals)",
  "function getLabels() view returns (string[])",
]);

const namesPath = fileURLToPath(new URL("../scripts/ensfairy-names.json", import.meta.url));

const asLabels = (values: unknown[]): string[] => values.filter((value): value is string => typeof value === "string");

export const readEnsfairyNames = (): { all: string[]; top200: string[]; } => {
  const raw: unknown = JSON.parse(readFileSync(namesPath, "utf8"));

  if (
    typeof raw !== "object"
    || raw === null
    || !("all" in raw)
    || !("top200" in raw)
    || !Array.isArray(raw.all)
    || !Array.isArray(raw.top200)
  ) {
    throw new Error("Malformed ensfairy-names.json — run scripts/fetch-ensfairy-names.mjs");
  }

  return { all: asLabels(raw.all), top200: asLabels(raw.top200) };
};

const createSeededPool = async (client: ForkClient, factory: Address, labels: string[]): Promise<Address> => {
  const createHash = await client.writeContract({
    abi: factorySeedAbi,
    account: testAccountAddress,
    address: factory,
    args: [testAccountAddress],
    chain: mainnet,
    functionName: "createPool",
  });
  const receipt = await client.waitForTransactionReceipt({ hash: createHash });
  const created = parseEventLogs({ abi: factorySeedAbi, eventName: "PoolCreated", logs: receipt.logs }).at(0);

  if (!created) throw new Error("Pool creation did not emit a PoolCreated event");

  const pool = created.args.pool;

  const configureHash = await client.writeContract({
    abi: poolSeedAbi,
    account: testAccountAddress,
    address: pool,
    args: [31_536_000n, 2_592_000n, 15_000_000_000n, 0n, 0n],
    chain: mainnet,
    functionName: "configurePool",
  });

  await client.waitForTransactionReceipt({ hash: configureHash });

  for (let index = 0; index < labels.length; index += 100) {
    const updateHash = await client.writeContract({
      abi: poolSeedAbi,
      account: testAccountAddress,
      address: pool,
      args: [labels.slice(index, index + 100), []],
      chain: mainnet,
      functionName: "updateLabels",
    });

    await client.waitForTransactionReceipt({ hash: updateHash });
  }

  const stored = await client.readContract({ abi: poolSeedAbi, address: pool, functionName: "getLabels" });

  if (stored.length !== labels.length) {
    throw new Error(`Fairy pool ${pool} stored ${stored.length}/${labels.length} labels`);
  }

  return pool;
};

export const seedEnsfairyPools = async (client: ForkClient, factory: Address): Promise<EnsfairyPools> => {
  const names = readEnsfairyNames();

  return {
    all: await createSeededPool(client, factory, names.all),
    top200: await createSeededPool(client, factory, names.top200),
  };
};

export const seedPoolLabelsEnv = (pools: EnsfairyPools): string =>
  `${pools.top200}:ensfairy top 200;${pools.all}:ensfairy all`;
