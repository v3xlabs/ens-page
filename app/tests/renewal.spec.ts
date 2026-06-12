import { createForkClient, type ForkClient } from "./anvil";
import { baseRegistrarAbi, baseRegistrarAddress, labelToTokenId } from "./ens";
import { expect, test } from "./fixtures";
import { readFixtures } from "./fixtures-file";

const oneYearSeconds = 31_536_000n;

const readExpiry = (client: ForkClient, label: string): Promise<bigint> =>
  client.readContract({
    abi: baseRegistrarAbi,
    address: baseRegistrarAddress,
    args: [labelToTokenId(label)],
    functionName: "nameExpires",
  });

test("batch renews a soon-expiring name and a grace-period name", async ({ page }) => {
  const client = createForkClient();
  const fixtures = readFixtures();
  const { expired, grace, soon } = fixtures.names;

  const soonExpiryBefore = await readExpiry(client, soon.label);
  const graceExpiryBefore = await readExpiry(client, grace.label);

  await page.goto("/");
  await page.getByTestId("connect-wallet").click();
  await page.locator("[data-testid^=\"connector-\"]").first()
    .click();
  await expect(page.getByTestId("wallet-profile")).toBeVisible();

  await page.goto("/names");

  const soonRow = page.getByTestId(`name-row-${soon.name}`);
  const graceRow = page.getByTestId(`name-row-${grace.name}`);
  const expiredRow = page.getByTestId(`name-row-${expired.name}`);

  await expect(soonRow).toBeVisible();
  await expect(graceRow).toBeVisible();
  await expect(expiredRow).not.toBeVisible();

  await page.getByTestId("expired-section-toggle").click();
  await expect(expiredRow).toBeVisible();

  await page.getByTestId("select-mode-toggle").click();
  await soonRow.click();
  await graceRow.click();

  await expect(page.getByTestId("cart-total")).toContainText(/\d+(\.\d+)?\s*ETH/);

  await page.getByTestId("cart-duration").selectOption({ index: 0 });

  await page.getByTestId("cart-review").click();
  await expect(page.getByTestId("tx-modal")).toBeVisible();

  await page.getByTestId("tx-confirm").click();

  await expect(page.getByTestId("tx-done")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId("tx-hash")).toBeVisible();

  const soonExpiryAfter = await readExpiry(client, soon.label);
  const graceExpiryAfter = await readExpiry(client, grace.label);

  expect(soonExpiryAfter - soonExpiryBefore).toBe(oneYearSeconds);
  expect(graceExpiryAfter - graceExpiryBefore).toBe(oneYearSeconds);

  await page.getByTestId("tx-done").click();
  await expect(page.getByTestId("tx-modal")).not.toBeVisible();

  await expect(page.getByTestId("cart-total")).not.toBeVisible();
  await expect(page.getByTestId("cart-review")).not.toBeVisible();
});
