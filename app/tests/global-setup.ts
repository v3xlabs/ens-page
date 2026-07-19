import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Instance, Server } from "prool";
import { type Abi, type Address, type Hex, namehash, parseAbi, parseEther, toHex } from "viem";
import { mainnet } from "viem/chains";

import { createForkClient, type ForkClient, forkRpcPort } from "./anvil";
import {
  baseRegistrarAbi,
  baseRegistrarAddress,
  chainlinkEthUsdFeedAddress,
  ensRegistryAbi,
  ensRegistryAddress,
  erc20Abi,
  expiryStorageSlot,
  labelToTokenId,
  oldEthControllerAddress,
  publicResolverAddress,
  testAccountAddress,
  uniswapSwapRouterAddress,
  usdcAddress,
  usdcBalanceSlot,
  wethAddress,
} from "./ens";
import { seedEnsfairyPools, seedPoolLabelsEnv } from "./ensfairy";
import { type AdapterFixtures, type NameFixture, writeFixtures } from "./fixtures-file";

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

// Matches the duration slider stops in the pool configuration UI.
const allowedDurationDays = [10n, 20n, 30n, 60n, 90n, 180n, 365n, 730n];

const factoryAdminAbi = parseAbi([
  "function setProtocolContracts(address ultraBulk, address baseRegistrar)",
  "function setDurationAllowed(uint256 duration, bool allowed)",
  "function setAdapterAllowed(address adapter, bool allowed)",
]);

type FactoryAdminCall =
  | { args: readonly [Address, Address]; functionName: "setProtocolContracts"; }
  | { args: readonly [Address, boolean]; functionName: "setAdapterAllowed"; }
  | { args: readonly [bigint, boolean]; functionName: "setDurationAllowed"; };

const writeFactoryAdmin = async (client: ForkClient, factory: Address, call: FactoryAdminCall) => {
  const base = { abi: factoryAdminAbi, account: testAccountAddress, address: factory, chain: mainnet } as const;

  const sendCall = () => {
    if (call.functionName === "setProtocolContracts") {
      return client.writeContract({ ...base, args: call.args, functionName: call.functionName });
    }

    if (call.functionName === "setDurationAllowed") {
      return client.writeContract({ ...base, args: call.args, functionName: call.functionName });
    }

    return client.writeContract({ ...base, args: call.args, functionName: call.functionName });
  };

  await client.waitForTransactionReceipt({ hash: await sendCall() });
};

// Mirrors the `just fork` recipe: UltraBulk + RenewalPoolFactory wired to the
// old controller and base registrar, slider durations allowed, and the three
// pool adapters (swap via the real Uniswap router, ERC4626 yield, streams)
// deployed and allow-listed.
const deployPoolContracts = async (client: ForkClient): Promise<{ adapters: AdapterFixtures; factory: Address; }> => {
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

  await writeFactoryAdmin(client, factory, { args: [ultraBulk, baseRegistrarAddress], functionName: "setProtocolContracts" });

  for (const days of allowedDurationDays) {
    await writeFactoryAdmin(client, factory, { args: [days * 86_400n, true], functionName: "setDurationAllowed" });
  }

  const swap = await deployContract(
    client,
    readArtifact("SwapAdapter.sol/SwapAdapter.json"),
    [uniswapSwapRouterAddress, wethAddress, chainlinkEthUsdFeedAddress],
  );
  const yieldAdapter = await deployContract(client, readArtifact("YieldAdapter.sol/YieldAdapter.json"), []);
  const stream = await deployContract(client, readArtifact("StreamAdapter.sol/StreamAdapter.json"), []);

  for (const adapter of [swap, yieldAdapter, stream]) {
    await writeFactoryAdmin(client, factory, { args: [adapter, true], functionName: "setAdapterAllowed" });
  }

  return { adapters: { stream, swap, yield: yieldAdapter }, factory };
};

const seedUsdcBalance = async (client: ForkClient, account: Address, amount: bigint) => {
  await client.setStorageAt({
    address: usdcAddress,
    index: usdcBalanceSlot(account),
    value: toHex(amount, { size: 32 }),
  });

  const balance = await client.readContract({
    abi: erc20Abi,
    address: usdcAddress,
    args: [account],
    functionName: "balanceOf",
  });

  if (balance !== amount) {
    throw new Error(`USDC balance seeding failed: expected ${amount}, read ${balance}`);
  }
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

  const { adapters, factory: poolFactoryAddress } = await deployPoolContracts(client);

  await seedUsdcBalance(client, testAccountAddress, 1_000_000_000_000n);

  const fairyPools = await seedEnsfairyPools(client, poolFactoryAddress);

  writeFileSync(
    testEnvPath,
    `VITE_RENEWAL_POOL_FACTORY_ADDRESS=${poolFactoryAddress}\nVITE_SEED_POOL_LABELS=${seedPoolLabelsEnv(fairyPools)}\n`,
  );

  writeFixtures({
    adapters,
    fairyPools,
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
