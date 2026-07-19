import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { type Address, type Hex, isHex, parseAbi, parseEventLogs } from "viem";

import type { ForkClient } from "./anvil";
import { testAccountAddress } from "./ens";

export type EnsfairyPools = {
  all: Address;
  appraised: Address;
};

type PoolSeed = {
  key: "all" | "appraised";
  label: string;
  labelCount: number;
  updateBatches: Hex[];
};

type SeedPayloads = {
  configurePoolData: Hex;
  createPoolData: Hex;
  pools: PoolSeed[];
};

const factoryEventAbi = parseAbi([
  "event PoolCreated(address indexed pool, address indexed poolOwner)",
]);

const poolReadAbi = parseAbi([
  "function getLabels() view returns (string[])",
]);

const seedPath = fileURLToPath(new URL("../scripts/ensfairy-seed.json", import.meta.url));

const isPoolSeed = (raw: unknown): raw is PoolSeed => {
  if (typeof raw !== "object" || raw === null) return false;

  const candidate = raw as Partial<PoolSeed>;

  return (candidate.key === "all" || candidate.key === "appraised")
    && typeof candidate.label === "string"
    && typeof candidate.labelCount === "number"
    && Array.isArray(candidate.updateBatches)
    && candidate.updateBatches.every(batch => isHex(batch));
};

const readSeedPayloads = (): SeedPayloads => {
  const raw: unknown = JSON.parse(readFileSync(seedPath, "utf8"));

  if (
    typeof raw !== "object"
    || raw === null
    || !("createPoolData" in raw)
    || !("configurePoolData" in raw)
    || !("pools" in raw)
    || !isHex(raw.createPoolData)
    || !isHex(raw.configurePoolData)
    || !Array.isArray(raw.pools)
    || !raw.pools.every(pool => isPoolSeed(pool))
  ) {
    throw new Error("Malformed ensfairy-seed.json — run scripts/precompute-ensfairy-seed.mjs");
  }

  return { configurePoolData: raw.configurePoolData, createPoolData: raw.createPoolData, pools: raw.pools };
};

const submit = async (client: ForkClient, to: Address, data: Hex): Promise<Hex> => {
  const hash = await client.sendTransaction({ account: testAccountAddress, data, to });

  await client.waitForTransactionReceipt({ hash });

  return hash;
};

const seedPool = async (client: ForkClient, factory: Address, payloads: SeedPayloads, poolSeed: PoolSeed): Promise<Address> => {
  const createHash = await submit(client, factory, payloads.createPoolData);
  const receipt = await client.getTransactionReceipt({ hash: createHash });
  const created = parseEventLogs({ abi: factoryEventAbi, eventName: "PoolCreated", logs: receipt.logs }).at(0);

  if (!created) throw new Error("Pool creation did not emit a PoolCreated event");

  const pool = created.args.pool;

  await submit(client, pool, payloads.configurePoolData);

  for (const batch of poolSeed.updateBatches) {
    await submit(client, pool, batch);
  }

  const stored = await client.readContract({ abi: poolReadAbi, address: pool, functionName: "getLabels" });

  if (stored.length !== poolSeed.labelCount) {
    throw new Error(`Fairy pool ${pool} stored ${stored.length}/${poolSeed.labelCount} labels`);
  }

  return pool;
};

export const seedEnsfairyPools = async (client: ForkClient, factory: Address): Promise<EnsfairyPools> => {
  const payloads = readSeedPayloads();
  const byKey = new Map(payloads.pools.map(pool => [pool.key, pool]));
  const appraised = byKey.get("appraised");
  const all = byKey.get("all");

  if (!appraised || !all) throw new Error("ensfairy-seed.json is missing a pool entry");

  return {
    all: await seedPool(client, factory, payloads, all),
    appraised: await seedPool(client, factory, payloads, appraised),
  };
};

export const seedPoolLabelsEnv = (pools: EnsfairyPools): string =>
  `${pools.appraised}:ensfairy appraised;${pools.all}:ensfairy all`;
