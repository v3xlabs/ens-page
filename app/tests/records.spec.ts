import { namehash } from "viem";

import { createForkClient, type ForkClient } from "./anvil";
import { publicResolverAbi, publicResolverAddress } from "./ens";
import { expect, test } from "./fixtures";
import { readFixtures } from "./fixtures-file";

const readTextRecord = (client: ForkClient, name: string, key: string): Promise<string> =>
  client.readContract({
    abi: publicResolverAbi,
    address: publicResolverAddress,
    args: [namehash(name), key],
    functionName: "text",
  });

test("edits a name's text records through the record editor", async ({ page }) => {
  const client = createForkClient();
  const { records } = readFixtures().names;
  const description = "Updated by the e2e suite";
  const twitter = "ens_page_test";

  await page.goto("/");
  await page.getByTestId("connect-wallet").click();
  await page.locator("[data-testid^=\"connector-\"]").first()
    .click();
  await expect(page.getByTestId("wallet-profile")).toBeVisible();

  await page.goto(`/${records.name}`);
  await page.getByTestId("edit-records").click();
  await expect(page).toHaveURL(`/${records.name}/edit`);

  const descriptionInput = page.getByTestId("record-input-description");

  const twitterInput = page.getByTestId("record-input-com.twitter");

  await descriptionInput.fill(description);
  await twitterInput.fill(twitter);

  // Both drafts must be registered before saving — a fill that lands while
  // the records query is still settling can be lost to a rerender.
  await expect(descriptionInput).toHaveValue(description);
  await expect(twitterInput).toHaveValue(twitter);
  await expect(page.getByText("2 records changed.")).toBeVisible();

  await page.getByTestId("edit-save").click();
  await expect(page.getByTestId("tx-modal")).toBeVisible();
  await page.getByTestId("tx-confirm").click();

  await expect(page.getByTestId("tx-done")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId("tx-hash")).toBeVisible();
  await expect(page.getByTestId("tx-fee")).toContainText("ETH");
  await page.getByTestId("tx-done").click();
  await expect(page.getByTestId("tx-modal")).not.toBeVisible();

  expect(await readTextRecord(client, records.name, "description")).toBe(description);
  expect(await readTextRecord(client, records.name, "com.twitter")).toBe(twitter);

  // Saving clears the drafts and invalidates the text queries, so the inputs
  // must settle on the freshly written on-chain values.
  await expect(descriptionInput).toHaveValue(description);

  await page.goto(`/${records.name}`);
  await expect(page.getByText(description)).toBeVisible();
});
