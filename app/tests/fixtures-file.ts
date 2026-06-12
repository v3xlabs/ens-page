import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { type Address, isAddress } from "viem";

export type NameFixture = {
  expirySeconds: number;
  label: string;
  name: string;
};

export type OnChainFixtures = {
  names: {
    expired: NameFixture;
    grace: NameFixture;
    soon: NameFixture;
  };
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

  const { testAddress } = raw;

  if (typeof testAddress !== "string" || !isAddress(testAddress)) {
    throw new Error("Malformed .fixtures.json: invalid testAddress");
  }

  return {
    names: {
      expired: parseNameFixture(raw["names"]["expired"]),
      grace: parseNameFixture(raw["names"]["grace"]),
      soon: parseNameFixture(raw["names"]["soon"]),
    },
    testAddress,
  };
};

export const writeFixtures = (fixtures: OnChainFixtures) => {
  writeFileSync(fixturesPath, `${JSON.stringify(fixtures, undefined, 2)}\n`);
};
