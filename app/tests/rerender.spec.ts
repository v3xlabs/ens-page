import { expect } from "@playwright/test";

import { test } from "./fixtures";

// Selecting a name must be a fine-grained update: class changes on the toggled
// row only — no rows added/removed, no scroll jump, no list rebuild.
test("selecting a name does not rebuild the list or move the page", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("connect-wallet").click();
  await page.locator("[data-testid^=\"connector-\"]").first()
    .click();
  await expect(page.getByTestId("wallet-profile")).toBeVisible();

  await page.goto("/names");
  await page.getByTestId("select-mode-toggle").click();
  await expect(page.getByTestId("name-row-ens-page-test-soon.eth")).toBeVisible();

  const observed = await page.evaluate(async () => {
    const rows = [...document.querySelectorAll<HTMLElement>("[data-testid^=\"name-row-\"]")];
    const container = rows[0]?.parentElement;

    if (!container) return { error: "no rows rendered" };

    let structuralMutations = 0;
    let attributeMutations = 0;

    // Rows may mutate internally (an avatar image resolving swaps its
    // placeholder); only direct children of the list container appearing or
    // disappearing means the list itself was rebuilt.
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "childList" && record.target === container && (record.addedNodes.length > 0 || record.removedNodes.length > 0)) {
          structuralMutations += 1;
        }

        if (record.type === "attributes") attributeMutations += 1;
      }
    });

    observer.observe(container, {
      attributeFilter: ["class"],
      attributes: true,
      childList: true,
      subtree: true,
    });

    const scrollBefore = window.scrollY;

    rows[0].click();
    await new Promise(resolve => setTimeout(resolve, 300));

    observer.disconnect();

    return {
      attributeMutations,
      rowCount: rows.length,
      scrollAfter: window.scrollY,
      scrollBefore,
      structuralMutations,
    };
  });

  expect(observed).not.toHaveProperty("error");
  expect(observed.structuralMutations, "no rows may be added or removed on selection").toBe(0);
  expect(observed.scrollAfter, "scroll position must not move on selection").toBe(observed.scrollBefore);
  expect(observed.attributeMutations, "the toggled row should update").toBeGreaterThan(0);
});
