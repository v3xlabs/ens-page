import { getAddress, getContractAddress, parseAbi, parseEther, parseGwei } from "viem";

import { createForkClient } from "./anvil";
import { expect, test } from "./fixtures";
import { readFixtures } from "./fixtures-file";

const factoryAbi = parseAbi([
  "function getPools() view returns (address[])",
]);

const poolAbi = parseAbi([
  "function owner() view returns (address)",
  "function getLabels() view returns (string[])",
  "function gasPriceCap() view returns (uint256)",
  "function renewalThreshold() view returns (uint64)",
]);

const daySeconds = 86_400;

test("creates, configures, funds, and manages names in an on-chain renewal pool", async ({ page }) => {
  const client = createForkClient();
  const fixtures = readFixtures();
  const { grace, soon } = fixtures.names;

  const readLabels = async (poolAddress: `0x${string}`): Promise<string[]> =>
    [...await client.readContract({
      abi: poolAbi,
      address: poolAddress,
      functionName: "getLabels",
    })];

  // A redeployed fork mints pools at the same CREATE addresses as the
  // previous session — seed a stale store entry at the next pool address to
  // prove creation overwrites it instead of resurrecting the old label.
  const factoryNonce = await client.getTransactionCount({ address: fixtures.poolFactoryAddress });
  const predictedPoolAddress = getContractAddress({ from: fixtures.poolFactoryAddress, nonce: BigInt(factoryNonce) });

  await page.addInitScript((stalePool) => {
    if (!globalThis.localStorage.getItem("ens-manager-pools")) {
      globalThis.localStorage.setItem("ens-manager-pools", JSON.stringify([stalePool]));
    }
  }, { balanceEth: 0, label: "test111", members: [], poolId: predictedPoolAddress });

  await page.goto("/");
  await page.getByTestId("connect-wallet").click();
  await page.locator("[data-testid^=\"connector-\"]").first()
    .click();
  await expect(page.getByTestId("wallet-profile")).toBeVisible();

  // Create a pool through the factory: review → confirm → success → navigate
  await page.goto("/pools");
  await page.getByTestId("pool-create").click();
  await page.getByTestId("pool-create-label").fill("e2e pool");
  await page.getByTestId("pool-create-submit").click();

  await expect(page.getByTestId("tx-modal")).toBeVisible();
  await expect(page.getByTestId("tx-summary")).toContainText("Deploy renewal pool");
  await page.getByTestId("tx-confirm").click();
  await expect(page.getByTestId("tx-done")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId("tx-fee")).toContainText("ETH");
  await expect(page.getByTestId("tx-summary")).toContainText("Pool address");
  await page.getByTestId("tx-done").click();

  await expect(page).toHaveURL(/\/pool\/0x[0-9a-fA-F]{40}$/, { timeout: 60_000 });

  const poolAddress = getAddress(new URL(page.url()).pathname.split("/")[2]);

  expect(poolAddress.toLowerCase()).toBe(predictedPoolAddress.toLowerCase());
  await expect(page.getByRole("heading", { name: "e2e pool" })).toBeVisible();
  await expect(page.getByText("test111")).not.toBeVisible();

  const registeredPools = await client.readContract({
    abi: factoryAbi,
    address: fixtures.poolFactoryAddress,
    functionName: "getPools",
  });

  expect(registeredPools.map(address => address.toLowerCase())).toContain(poolAddress.toLowerCase());

  const poolOwner = await client.readContract({ abi: poolAbi, address: poolAddress, functionName: "owner" });

  expect(poolOwner.toLowerCase()).toBe(fixtures.testAddress.toLowerCase());

  // Configure the pool: slide the renewal window to 60 days, 25 gwei ceiling
  await page.getByTestId("pool-config-edit").click();

  const windowSlider = page.getByTestId("pool-config-window");

  await windowSlider.focus();
  await windowSlider.press("Home");
  await windowSlider.press("ArrowRight");
  await windowSlider.press("ArrowRight");
  await windowSlider.press("ArrowRight");

  await page.getByTestId("pool-config-gas").fill("25");
  await page.getByTestId("pool-config-save").click();

  await expect(page.getByTestId("tx-modal")).toBeVisible();
  await expect(page.getByTestId("tx-summary")).toContainText("60 days before expiry");
  await expect(page.getByTestId("tx-summary")).toContainText("25 gwei");
  await page.getByTestId("tx-confirm").click();
  await expect(page.getByTestId("tx-done")).toBeVisible({ timeout: 120_000 });
  await page.getByTestId("tx-done").click();
  await expect(page.getByTestId("tx-modal")).not.toBeVisible();

  await expect(page.getByText("60 days before expiry")).toBeVisible();
  await expect(page.getByText("25 gwei")).toBeVisible();

  await expect.poll(() => client.readContract({ abi: poolAbi, address: poolAddress, functionName: "gasPriceCap" })).toBe(parseGwei("25"));
  await expect.poll(async () => Number(await client.readContract({ abi: poolAbi, address: poolAddress, functionName: "renewalThreshold" }))).toBe(60 * daySeconds);

  // Add two names in one staged update
  await page.getByTestId("pool-names-edit").click();

  const nameInput = page.getByTestId("pool-names-input");

  await nameInput.fill(soon.label);
  await nameInput.press("Enter");
  await nameInput.fill(grace.label);
  await nameInput.press("Enter");

  await page.getByTestId("pool-names-review").click();
  await expect(page.getByTestId("tx-modal")).toBeVisible();
  await page.getByTestId("tx-confirm").click();
  await expect(page.getByTestId("tx-done")).toBeVisible({ timeout: 120_000 });
  await page.getByTestId("tx-done").click();
  await expect(page.getByTestId("tx-modal")).not.toBeVisible();

  await expect.poll(() => readLabels(poolAddress)).toEqual(expect.arrayContaining([soon.label, grace.label]));
  await expect(page.getByText(soon.name, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(grace.name, { exact: true }).first()).toBeVisible();

  // Remove one name again
  await page.getByTestId("pool-names-edit").click();
  await page.getByTestId(`pool-names-remove-${grace.name}`).click();
  await page.getByTestId("pool-names-review").click();
  await expect(page.getByTestId("tx-modal")).toBeVisible();
  await page.getByTestId("tx-confirm").click();
  await expect(page.getByTestId("tx-done")).toBeVisible({ timeout: 120_000 });
  await page.getByTestId("tx-done").click();
  await expect(page.getByTestId("tx-modal")).not.toBeVisible();

  await expect.poll(() => readLabels(poolAddress)).toEqual([soon.label]);
  await expect(page.getByText(grace.name, { exact: true })).not.toBeVisible();

  // Fund the pool with 0.5 ETH through the token tab
  await page.getByTestId("pool-fund").click();
  await page.getByTestId("fund-amount").fill("0.5");
  await page.getByTestId("fund-review").click();
  await expect(page.getByTestId("tx-modal")).toBeVisible();
  await page.getByTestId("tx-confirm").click();
  await expect(page.getByTestId("tx-done")).toBeVisible({ timeout: 120_000 });
  await page.getByTestId("tx-done").click();
  await expect(page.getByTestId("tx-modal")).not.toBeVisible();

  expect(await client.getBalance({ address: poolAddress })).toBe(parseEther("0.5"));

  // Withdraw 0.2 ETH back to the wallet
  await page.getByTestId("pool-withdraw").click();
  await page.getByTestId("pool-funding-amount").fill("0.2");
  await page.getByTestId("tx-confirm").click();
  await expect(page.getByTestId("tx-done")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId("tx-hash")).toBeVisible();
  await page.getByTestId("tx-done").click();
  await expect(page.getByTestId("tx-modal")).not.toBeVisible();

  expect(await client.getBalance({ address: poolAddress })).toBe(parseEther("0.3"));

  // Rename the local note and make sure it sticks across a reload
  await page.getByTestId("pool-label-edit").click();
  await page.getByTestId("pool-label-input").fill("hello world");
  await page.getByTestId("pool-label-save").click();
  await expect(page.getByRole("heading", { name: "hello world" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "hello world" })).toBeVisible();
});
