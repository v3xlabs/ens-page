import { createTestClient, http, publicActions, walletActions } from "viem";
import { mainnet } from "viem/chains";

// Own port so the suite never collides with a `just fork` anvil on 8545.
export const forkRpcPort = 8547;

export const forkRpcUrl = `http://127.0.0.1:${forkRpcPort}/1`;

export const createForkClient = () =>
  createTestClient({
    chain: mainnet,
    mode: "anvil",
    transport: http(forkRpcUrl, { timeout: 60_000 }),
  })
    .extend(publicActions)
    .extend(walletActions);

export type ForkClient = ReturnType<typeof createForkClient>;
