import { Instance, Server } from "prool";
import { parseEther, toHex } from "viem";
import { mainnet } from "viem/chains";

import { createForkClient, type ForkClient } from "./anvil";
import {
  baseRegistrarAbi,
  baseRegistrarAddress,
  expiryStorageSlot,
  labelToTokenId,
  oldEthControllerAddress,
  testAccountAddress,
} from "./ens";
import { type NameFixture, writeFixtures } from "./fixtures-file";

const daySeconds = 86_400n;

const registerName = async (
  client: ForkClient,
  label: string,
  durationSeconds: bigint,
): Promise<bigint> => {
  const tokenId = labelToTokenId(label);

  const isAvailable = await client.readContract({
    abi: baseRegistrarAbi,
    address: baseRegistrarAddress,
    args: [tokenId],
    functionName: "available",
  });

  if (!isAvailable) {
    throw new Error(`${label}.eth is unexpectedly registered on the forked chain`);
  }

  const registerHash = await client.writeContract({
    abi: baseRegistrarAbi,
    account: oldEthControllerAddress,
    address: baseRegistrarAddress,
    args: [tokenId, testAccountAddress, durationSeconds],
    chain: mainnet,
    functionName: "register",
  });

  await client.waitForTransactionReceipt({ hash: registerHash });

  return tokenId;
};

const readExpiry = (client: ForkClient, tokenId: bigint): Promise<bigint> =>
  client.readContract({
    abi: baseRegistrarAbi,
    address: baseRegistrarAddress,
    args: [tokenId],
    functionName: "nameExpires",
  });

const overwriteExpiry = async (
  client: ForkClient,
  tokenId: bigint,
  expirySeconds: bigint,
): Promise<void> => {
  await client.setStorageAt({
    address: baseRegistrarAddress,
    index: expiryStorageSlot(tokenId),
    value: toHex(expirySeconds, { size: 32 }),
  });

  const storedExpiry = await readExpiry(client, tokenId);

  if (storedExpiry !== expirySeconds) {
    throw new Error(
      `Expiry storage write failed: nameExpires returned ${storedExpiry}, expected ${expirySeconds}`,
    );
  }
};

const createNameFixture = async (
  client: ForkClient,
  label: string,
  registrationSeconds: bigint,
  overwrittenExpirySeconds?: bigint,
): Promise<NameFixture> => {
  const tokenId = await registerName(client, label, registrationSeconds);

  if (overwrittenExpirySeconds !== undefined) {
    await overwriteExpiry(client, tokenId, overwrittenExpirySeconds);
  }

  const expiry = await readExpiry(client, tokenId);

  return { expirySeconds: Number(expiry), label, name: `${label}.eth` };
};

const globalSetup = async () => {
  const forkUrl = process.env["TEST_FORK_RPC_URL"] ?? "https://ethereum.reth.rs/rpc";
  const server = Server.create({
    instance: Instance.anvil({ forkUrl }),
    limit: 1,
    port: 8545,
  });

  await server.start();

  const client = createForkClient();

  await client.impersonateAccount({ address: oldEthControllerAddress });
  await client.setBalance({ address: oldEthControllerAddress, value: parseEther("1") });

  const { timestamp: nowSeconds } = await client.getBlock();

  const soon = await createNameFixture(client, "ens-page-test-soon", 20n * daySeconds);

  const grace = await createNameFixture(
    client,
    "ens-page-test-grace",
    365n * daySeconds,
    nowSeconds - 5n * daySeconds,
  );

  const expired = await createNameFixture(
    client,
    "ens-page-test-expired",
    365n * daySeconds,
    nowSeconds - 150n * daySeconds,
  );

  writeFixtures({ names: { expired, grace, soon }, testAddress: testAccountAddress });

  return async () => {
    await server.stop();
  };
};

// eslint-disable-next-line import/no-default-export
export default globalSetup;
