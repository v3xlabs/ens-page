import { expect, test } from "@playwright/test";
import { namehash } from "viem";

import { createForkClient, type ForkClient } from "./anvil";
import {
  baseRegistrarAbi,
  baseRegistrarAddress,
  ensRegistryAbi,
  ensRegistryAddress,
  labelToTokenId,
  testAccountAddress,
} from "./ens";
import { readFixtures } from "./fixtures-file";

const daySeconds = 86_400;

const readExpirySeconds = async (client: ForkClient, label: string): Promise<number> => {
  const expiry = await client.readContract({
    abi: baseRegistrarAbi,
    address: baseRegistrarAddress,
    args: [labelToTokenId(label)],
    functionName: "nameExpires",
  });

  return Number(expiry);
};

test.describe("fork fixtures", () => {
  test("all fixture names are owned by the test account", async () => {
    const client = createForkClient();
    const fixtures = readFixtures();

    // Registry ownership persists past expiry; registrar ownerOf reverts for
    // any expired token, so it is only asserted for the unexpired name.
    for (const entry of Object.values(fixtures.names)) {
      const registryOwner = await client.readContract({
        abi: ensRegistryAbi,
        address: ensRegistryAddress,
        args: [namehash(entry.name)],
        functionName: "owner",
      });

      expect(registryOwner.toLowerCase()).toBe(testAccountAddress.toLowerCase());
    }

    const soonTokenOwner = await client.readContract({
      abi: baseRegistrarAbi,
      address: baseRegistrarAddress,
      args: [labelToTokenId(fixtures.names.soon.label)],
      functionName: "ownerOf",
    });

    expect(soonTokenOwner.toLowerCase()).toBe(testAccountAddress.toLowerCase());
  });

  test("expiries match the crafted soon, grace, and expired states", async () => {
    const client = createForkClient();
    const fixtures = readFixtures();
    const { timestamp } = await client.getBlock();
    const nowSeconds = Number(timestamp);

    const soonExpiry = await readExpirySeconds(client, fixtures.names.soon.label);
    const graceExpiry = await readExpirySeconds(client, fixtures.names.grace.label);
    const expiredExpiry = await readExpirySeconds(client, fixtures.names.expired.label);

    expect(soonExpiry).toBe(fixtures.names.soon.expirySeconds);
    expect(graceExpiry).toBe(fixtures.names.grace.expirySeconds);
    expect(expiredExpiry).toBe(fixtures.names.expired.expirySeconds);

    expect(soonExpiry).toBeGreaterThan(nowSeconds);
    expect(soonExpiry - nowSeconds).toBeLessThan(30 * daySeconds);

    expect(graceExpiry).toBeLessThan(nowSeconds);
    expect(nowSeconds - graceExpiry).toBeLessThan(90 * daySeconds);

    expect(nowSeconds - expiredExpiry).toBeGreaterThan(90 * daySeconds);
  });
});
