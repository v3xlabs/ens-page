import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Instance, Server } from "prool";
import { type Abi, type Address, type Hex, namehash, parseAbi, parseEther, toHex } from "viem";
import { mainnet } from "viem/chains";

import { createForkClient, type ForkClient, forkRpcPort } from "./anvil";
import {
  baseRegistrarAbi,
  baseRegistrarAddress,
  ensRegistryAbi,
  ensRegistryAddress,
  expiryStorageSlot,
  labelToTokenId,
  oldEthControllerAddress,
  publicResolverAddress,
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

type ContractArtifact = {
  abi: Abi;
  bytecode: Hex;
};

const readArtifact = (relativePath: string): ContractArtifact => {
  const artifactPath = fileURLToPath(new URL(`../../contracts/out/${relativePath}`, import.meta.url));
  const raw: unknown = JSON.parse(readFileSync(artifactPath, "utf8"));

  if (typeof raw !== "object" || raw === null || !("abi" in raw) || !("bytecode" in raw)) {
    throw new Error(`Malformed foundry artifact at ${relativePath}`);
  }

  const { bytecode } = raw as { bytecode: unknown; };

  if (
    typeof bytecode !== "object"
    || bytecode === null
    || !("object" in bytecode)
    || typeof bytecode.object !== "string"
    || !bytecode.object.startsWith("0x")
  ) {
    throw new Error(`Foundry artifact ${relativePath} has no deployable bytecode — run \`forge build\` in contracts/`);
  }

  return { abi: (raw as { abi: Abi; }).abi, bytecode: bytecode.object as Hex };
};

const deployContract = async (
  client: ForkClient,
  artifact: ContractArtifact,
  args: readonly unknown[],
): Promise<Address> => {
  const hash = await client.deployContract({
    abi: artifact.abi,
    account: testAccountAddress,
    args,
    bytecode: artifact.bytecode,
    chain: mainnet,
  });

  const receipt = await client.waitForTransactionReceipt({ hash });

  if (!receipt.contractAddress) {
    throw new Error("Contract deployment produced no address");
  }

  return receipt.contractAddress;
};

const oneYearSeconds = 31_536_000n;

const factoryAdminAbi = parseAbi([
  "function setProtocolContracts(address ultraBulk, address baseRegistrar)",
  "function setDurationAllowed(uint256 duration, bool allowed)",
]);

// Mirrors the `just fork` recipe: UltraBulk + RenewalPoolFactory wired to the
// old controller and base registrar, with 1-year renewals allowed.
const deployPoolContracts = async (client: ForkClient): Promise<Address> => {
  const ultraBulk = await deployContract(
    client,
    readArtifact("UltraBulk.sol/UltraBulk.json"),
    [oldEthControllerAddress],
  );

  const factory = await deployContract(
    client,
    readArtifact("RenewalPoolFactory.sol/RenewalPoolFactory.json"),
    [testAccountAddress],
  );

  const wireHash = await client.writeContract({
    abi: factoryAdminAbi,
    account: testAccountAddress,
    address: factory,
    args: [ultraBulk, baseRegistrarAddress],
    chain: mainnet,
    functionName: "setProtocolContracts",
  });

  await client.waitForTransactionReceipt({ hash: wireHash });

  const durationHash = await client.writeContract({
    abi: factoryAdminAbi,
    account: testAccountAddress,
    address: factory,
    args: [oneYearSeconds, true],
    chain: mainnet,
    functionName: "setDurationAllowed",
  });

  await client.waitForTransactionReceipt({ hash: durationHash });

  return factory;
};

const setNameResolver = async (client: ForkClient, name: string, resolver: Address) => {
  const hash = await client.writeContract({
    abi: ensRegistryAbi,
    account: testAccountAddress,
    address: ensRegistryAddress,
    args: [namehash(name), resolver],
    chain: mainnet,
    functionName: "setResolver",
  });

  await client.waitForTransactionReceipt({ hash });
};

// Vite loads .env.development.local with higher priority than the developer's
// .env.local, so the app under test sees the factory deployed on this fork.
const testEnvPath = fileURLToPath(new URL("../.env.development.local", import.meta.url));

const globalSetup = async () => {
  const forkUrl = process.env["TEST_FORK_RPC_URL"] ?? "https://ethereum.reth.rs/rpc";
  const server = Server.create({
    instance: Instance.anvil({ forkUrl }),
    limit: 1,
    port: forkRpcPort,
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

  const records = await createNameFixture(client, "ens-page-test-records", 365n * daySeconds);

  await setNameResolver(client, records.name, publicResolverAddress);

  const poolFactoryAddress = await deployPoolContracts(client);

  writeFileSync(testEnvPath, `VITE_RENEWAL_POOL_FACTORY_ADDRESS=${poolFactoryAddress}\n`);

  writeFixtures({
    names: { expired, grace, records, soon },
    poolFactoryAddress,
    testAddress: testAccountAddress,
  });

  return async () => {
    rmSync(testEnvPath, { force: true });
    await server.stop();
  };
};

// eslint-disable-next-line import/no-default-export
export default globalSetup;
