import { parseAbi, parseEther } from "viem";
import { mainnet } from "viem/chains";

import { createForkClient } from "./anvil";
import { baseRegistrarAbi, baseRegistrarAddress, ensfairyAddress, labelToTokenId, testAccountAddress } from "./ens";
import { expect, test } from "./fixtures";
import { readFixtures } from "./fixtures-file";

const poolAbi = parseAbi([
  "function getLabels() view returns (string[])",
]);

test("marks fairy-held names and lists the seeded fairy pools", async ({ page }) => {
  const client = createForkClient();
  const fixtures = readFixtures();
  const { soon } = fixtures.names;
  const tokenId = labelToTokenId(soon.label);

  // Gift the soon name to the fairy for the duration of this test
  const giftHash = await client.writeContract({
    abi: baseRegistrarAbi,
    account: testAccountAddress,
    address: baseRegistrarAddress,
    args: [testAccountAddress, ensfairyAddress, tokenId],
    chain: mainnet,
    functionName: "transferFrom",
  });

  await client.waitForTransactionReceipt({ hash: giftHash });

  await page.goto("/");
  await page.getByTestId("connect-wallet").click();
  await page.locator("[data-testid^=\"connector-\"]").first()
    .click();
  await expect(page.getByTestId("wallet-profile")).toBeVisible();

  await page.goto("/names");
  await expect(page.getByTestId(`fairy-badge-${soon.name}`)).toBeVisible();
  await expect(page.getByTestId(`fairy-badge-${fixtures.names.records.name}`)).not.toBeVisible();

  await page.goto(`/${soon.name}`);
  await expect(page.getByTestId(`fairy-badge-${soon.name}`)).toBeVisible();

  // Seeded fairy pools show up with their labels and real member lists
  await page.goto("/pools");
  await expect(page.getByText("ensfairy top 200")).toBeVisible();
  await expect(page.getByText("ensfairy all")).toBeVisible();

  const top200Labels = await client.readContract({
    abi: poolAbi,
    address: fixtures.fairyPools.top200,
    functionName: "getLabels",
  });
  const allLabels = await client.readContract({
    abi: poolAbi,
    address: fixtures.fairyPools.all,
    functionName: "getLabels",
  });

  expect(top200Labels).toHaveLength(200);
  expect(allLabels.length).toBeGreaterThan(200);

  // Return the gift so later specs see the fixture ownership they expect
  await client.impersonateAccount({ address: ensfairyAddress });
  await client.setBalance({ address: ensfairyAddress, value: parseEther("1") });

  const returnHash = await client.writeContract({
    abi: baseRegistrarAbi,
    account: ensfairyAddress,
    address: baseRegistrarAddress,
    args: [ensfairyAddress, testAccountAddress, tokenId],
    chain: mainnet,
    functionName: "transferFrom",
  });

  await client.waitForTransactionReceipt({ hash: returnHash });
  await client.stopImpersonatingAccount({ address: ensfairyAddress });
});
