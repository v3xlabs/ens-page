import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { type Address, isAddress } from "viem";

export type NameFixture = {
  expirySeconds: number;
  label: string;
  name: string;
};

export type AdapterFixtures = {
  stream: Address;
  swap: Address;
  yield: Address;
};

export type FairyPoolFixtures = {
  all: Address;
  top200: Address;
};

export type OnChainFixtures = {
  adapters: AdapterFixtures;
  fairyPools: FairyPoolFixtures;
  names: {
    expired: NameFixture;
    grace: NameFixture;
    records: NameFixture;
    soon: NameFixture;
  };
  poolFactoryAddress: Address;
  testAddress: Address;
};

const fixturesPath = fileURLToPath(new URL(".fixtures.json", import.meta.url));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value instanceof Object;

const parseNameFixture = (value: unknown): NameFixture => {
  if (!isRecord(value)) {
    throw new Error("Malformed .fixtures.json: expected a name fixture object");
  }

  const { expirySeconds, label, name } = value;

  if (
    typeof expirySeconds !== "number"
    || typeof label !== "string"
    || typeof name !== "string"
  ) {
    throw new TypeError("Malformed .fixtures.json: invalid name fixture fields");
  }

  return { expirySeconds, label, name };
};

export const readFixtures = (): OnChainFixtures => {
  const raw: unknown = JSON.parse(readFileSync(fixturesPath, "utf8"));

  if (!isRecord(raw) || !isRecord(raw["names"])) {
    throw new Error("Malformed .fixtures.json: run the suite via playwright global setup");
  }

  const { adapters, fairyPools, poolFactoryAddress, testAddress } = raw;

  if (typeof testAddress !== "string" || !isAddress(testAddress)) {
    throw new Error("Malformed .fixtures.json: invalid testAddress");
  }

  if (typeof poolFactoryAddress !== "string" || !isAddress(poolFactoryAddress)) {
    throw new Error("Malformed .fixtures.json: invalid poolFactoryAddress");
  }

  if (!isRecord(adapters)) {
    throw new Error("Malformed .fixtures.json: missing adapters");
  }

  if (!isRecord(fairyPools) || typeof fairyPools["all"] !== "string" || !isAddress(fairyPools["all"])
    || typeof fairyPools["top200"] !== "string" || !isAddress(fairyPools["top200"])) {
    throw new Error("Malformed .fixtures.json: invalid fairyPools");
  }

  const parsedFairyPools = { all: fairyPools["all"], top200: fairyPools["top200"] };

  const parseAdapter = (key: "stream" | "swap" | "yield"): Address => {
    const value = adapters[key];

    if (typeof value !== "string" || !isAddress(value)) {
      throw new Error(`Malformed .fixtures.json: invalid ${key} adapter address`);
    }

    return value;
  };

  return {
    adapters: { stream: parseAdapter("stream"), swap: parseAdapter("swap"), yield: parseAdapter("yield") },
    fairyPools: parsedFairyPools,
    names: {
      expired: parseNameFixture(raw["names"]["expired"]),
      grace: parseNameFixture(raw["names"]["grace"]),
      records: parseNameFixture(raw["names"]["records"]),
      soon: parseNameFixture(raw["names"]["soon"]),
    },
    poolFactoryAddress,
    testAddress,
  };
};

export const writeFixtures = (fixtures: OnChainFixtures) => {
  writeFileSync(fixturesPath, `${JSON.stringify(fixtures, undefined, 2)}\n`);
};
