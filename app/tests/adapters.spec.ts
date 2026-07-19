import { parseAbi, parseEther } from "viem";

import { createForkClient } from "./anvil";
import { erc20Abi, usdcAddress } from "./ens";
import { expect, test } from "./fixtures";
import { readFixtures } from "./fixtures-file";

const poolAbi = parseAbi([
  "function isAdapterEnabled(address adapter) view returns (bool)",
  "function getTokenRoute(address token) view returns ((address adapter, bytes data)[])",
]);

test("enables adapters, routes a USDC deposit to ETH, and claims a stream", async ({ page }) => {
  const client = createForkClient();
  const fixtures = readFixtures();

  await page.goto("/");
  await page.getByTestId("connect-wallet").click();
  await page.locator("[data-testid^=\"connector-\"]").first()
    .click();
  await expect(page.getByTestId("wallet-profile")).toBeVisible();

  // A fresh pool for this spec
  await page.goto("/pools");
  await page.getByTestId("pool-create").click();
  await page.getByTestId("pool-create-label").fill("adapters pool");
  await page.getByTestId("pool-create-submit").click();
  await expect(page.getByTestId("tx-modal")).toBeVisible();
  await page.getByTestId("tx-confirm").click();
  await expect(page.getByTestId("tx-done")).toBeVisible({ timeout: 120_000 });
  await page.getByTestId("tx-done").click();
  await expect(page).toHaveURL(/\/pool\/0x[0-9a-fA-F]{40}$/, { timeout: 60_000 });

  const poolAddress = new URL(page.url()).pathname.split("/")[2] as `0x${string}`;

  // Enable the swap + stream adapters AND configure the USDC route in one tx
  await page.getByTestId("adapters-edit").click();
  await page.getByTestId("adapter-check-swap").check();
  await page.getByTestId("adapter-check-stream").check();
  await page.getByTestId("route-kind-USDC").selectOption("swap");
  await page.getByTestId("adapters-save").click();

  await expect(page.getByTestId("tx-modal")).toBeVisible();
  await expect(page.getByTestId("tx-summary")).toContainText("Update adapters & routes");
  await expect(page.getByTestId("tx-summary")).toContainText("USDC route");
  await page.getByTestId("tx-confirm").click();
  await expect(page.getByTestId("tx-done")).toBeVisible({ timeout: 120_000 });
  await page.getByTestId("tx-done").click();
  await expect(page.getByTestId("tx-modal")).not.toBeVisible();

  for (const kind of ["swap", "stream"] as const) {
    await expect.poll(() => client.readContract({
      abi: poolAbi,
      address: poolAddress,
      args: [fixtures.adapters[kind]],
      functionName: "isAdapterEnabled",
    })).toBe(true);
  }

  const route = await client.readContract({
    abi: poolAbi,
    address: poolAddress,
    args: [usdcAddress],
    functionName: "getTokenRoute",
  });

  expect(route).toHaveLength(1);
  expect(route[0].adapter.toLowerCase()).toBe(fixtures.adapters.swap.toLowerCase());

  // Fund with USDC through the token tab
  await page.getByTestId("pool-fund").click();
  await page.getByTestId("fund-token-select").selectOption(usdcAddress);
  await page.getByTestId("fund-amount").fill("250");
  await page.getByTestId("fund-review").click();
  await expect(page.getByTestId("tx-modal")).toBeVisible();
  await expect(page.getByTestId("tx-summary")).toContainText("250 USDC");
  await page.getByTestId("tx-confirm").click();
  await expect(page.getByTestId("tx-done")).toBeVisible({ timeout: 120_000 });
  await page.getByTestId("tx-done").click();
  await expect(page.getByTestId("tx-modal")).not.toBeVisible();

  expect(await client.readContract({
    abi: erc20Abi,
    address: usdcAddress,
    args: [poolAddress],
    functionName: "balanceOf",
  })).toBe(250_000_000n);

  // Convert the deposit to ETH through the real Uniswap pool on the fork
  const ethBefore = await client.getBalance({ address: poolAddress });

  await page.getByTestId("route-convert-USDC").click();
  await expect(page.getByTestId("tx-modal")).toBeVisible();
  await page.getByTestId("tx-confirm").click();
  await expect(page.getByTestId("tx-done")).toBeVisible({ timeout: 120_000 });
  await page.getByTestId("tx-done").click();
  await expect(page.getByTestId("tx-modal")).not.toBeVisible();

  const ethAfter = await client.getBalance({ address: poolAddress });

  expect(ethAfter > ethBefore).toBe(true);
  expect(await client.readContract({
    abi: erc20Abi,
    address: usdcAddress,
    args: [poolAddress],
    functionName: "balanceOf",
  })).toBe(0n);

  // Open a 0.3 ETH / 30 day stream through the stream tab
  await page.getByTestId("pool-fund").click();
  await page.getByTestId("fund-tab-stream").click();
  await page.getByTestId("fund-amount").fill("0.3");
  await page.getByTestId("fund-duration").selectOption("30");
  await page.getByTestId("fund-review").click();
  await expect(page.getByTestId("tx-modal")).toBeVisible();
  await expect(page.getByTestId("tx-summary")).toContainText("30 days");
  await page.getByTestId("tx-confirm").click();
  await expect(page.getByTestId("tx-done")).toBeVisible({ timeout: 120_000 });
  await page.getByTestId("tx-done").click();
  await expect(page.getByTestId("tx-modal")).not.toBeVisible();

  // A third of the stream vests after ten days
  await client.increaseTime({ seconds: 10 * 86_400 });
  await client.mine({ blocks: 1 });
  await page.reload();

  await page.getByRole("tab", { name: "Funding history" }).click();

  const claimButton = page.locator("[data-testid^=\"stream-claim-\"]");

  await expect(claimButton).toBeVisible();
  await claimButton.click();
  await expect(page.getByTestId("tx-modal")).toBeVisible();
  await page.getByTestId("tx-confirm").click();
  await expect(page.getByTestId("tx-done")).toBeVisible({ timeout: 120_000 });
  await page.getByTestId("tx-done").click();

  await expect.poll(async () => {
    const balance = await client.getBalance({ address: poolAddress });

    return balance - ethAfter;
  }).toBeGreaterThanOrEqual(parseEther("0.09"));

  // Track an arbitrary ERC4626 token (sDAI) — probed as a vault, it gets the
  // redeem-then-swap route, staged and applied together with the yield adapter
  // in one transaction.
  const sdaiAddress = "0x83F20F44975D03b1b09e64809B757c47f942BEeA";

  await page.getByRole("tab", { name: "Overview" }).click();
  await page.getByTestId("adapters-edit").click();
  await page.getByTestId("add-token-input").fill(sdaiAddress);
  await page.getByTestId("add-token-submit").click();

  const sdaiRouteKind = page.getByTestId("route-kind-sDAI");

  await expect(sdaiRouteKind).toBeVisible();
  await expect(sdaiRouteKind.locator("option[value=\"yield-swap\"]")).toHaveCount(1);
  await expect(sdaiRouteKind.locator("option[value=\"swap\"]")).toHaveCount(0);

  await page.getByTestId("adapter-check-yield").check();
  await sdaiRouteKind.selectOption("yield-swap");
  await page.getByTestId("adapters-save").click();
  await expect(page.getByTestId("tx-modal")).toBeVisible();
  await page.getByTestId("tx-confirm").click();
  await expect(page.getByTestId("tx-done")).toBeVisible({ timeout: 120_000 });
  await page.getByTestId("tx-done").click();

  const sdaiRoute = await client.readContract({
    abi: poolAbi,
    address: poolAddress,
    args: [sdaiAddress],
    functionName: "getTokenRoute",
  });

  expect(sdaiRoute).toHaveLength(2);
  expect(sdaiRoute[0].adapter.toLowerCase()).toBe(fixtures.adapters.yield.toLowerCase());
  expect(sdaiRoute[1].adapter.toLowerCase()).toBe(fixtures.adapters.swap.toLowerCase());
});
