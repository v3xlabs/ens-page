import { type Page, test as base } from "@playwright/test";

import { forkRpcUrl } from "./anvil";
import { type OnChainFixtures, readFixtures } from "./fixtures-file";

const installWalletMock = async (page: Page, fixtures: OnChainFixtures) => {
  await page.addInitScript(
    ({ address, rpcUrl }) => {
      let requestId = 0;

      const request = async ({
        method,
        params,
      }: {
        method: string;
        params?: unknown;
      }): Promise<unknown> => {
        if (method === "eth_requestAccounts" || method === "eth_accounts") {
          return [address];
        }

        requestId += 1;

        const response = await fetch(rpcUrl, {
          // eslint-disable-next-line no-restricted-syntax -- JSON-RPC wire format requires `id`
          body: JSON.stringify({ id: requestId, jsonrpc: "2.0", method, params }),
          headers: { "content-type": "application/json" },
          method: "POST",
        });

        const payload: unknown = await response.json();

        if (!payload || typeof payload !== "object") {
          throw new Error(`Malformed JSON-RPC response for ${method}`);
        }

        if ("error" in payload && payload.error && typeof payload.error === "object") {
          const rpcError = payload.error;

          const message
            = "message" in rpcError && typeof rpcError.message === "string"
              ? rpcError.message
              : `JSON-RPC error for ${method}`;

          const code
            = "code" in rpcError && typeof rpcError.code === "number"
              ? rpcError.code
              : -32_000;

          throw Object.assign(new Error(message), { code });
        }

        if ("result" in payload) {
          return payload.result;
        }

        throw new Error(`Malformed JSON-RPC response for ${method}`);
      };

      const provider = {
        isMetaMask: true,
        on: () => {},
        removeListener: () => {},
        request,
      };

      Object.defineProperty(globalThis, "ethereum", { configurable: true, value: provider });
    },
    { address: fixtures.testAddress, rpcUrl: forkRpcUrl },
  );
};

const seedLocalStorage = async (page: Page, fixtures: OnChainFixtures) => {
  const { expired, grace, soon } = fixtures.names;

  const ownedNames = {
    [fixtures.testAddress.toLowerCase()]: [soon, grace, expired].map(entry => ({
      expiryDate: entry.expirySeconds,
      name: entry.name,
    })),
  };

  const storageEntries: [string, string][] = [
    ["ens-manager-owned-names", JSON.stringify(ownedNames)],
    ["ens-manager-settings", JSON.stringify({ nameSearchRetention: true })],
  ];

  await page.addInitScript((entries: [string, string][]) => {
    for (const [key, value] of entries) {
      globalThis.localStorage.setItem(key, value);
    }
  }, storageEntries);
};

export const test = base.extend({
  page: async ({ page }, use) => {
    const fixtures = readFixtures();

    await installWalletMock(page, fixtures);
    await seedLocalStorage(page, fixtures);

    await use(page);
  },
});

export { expect } from "@playwright/test";
