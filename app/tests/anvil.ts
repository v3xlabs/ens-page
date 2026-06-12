import { createTestClient, http, publicActions, walletActions } from "viem";
import { mainnet } from "viem/chains";

export const forkRpcUrl = "http://127.0.0.1:8545/1";

export const createForkClient = () =>
  createTestClient({
    chain: mainnet,
    mode: "anvil",
    transport: http(forkRpcUrl, { timeout: 60_000 }),
  })
    .extend(publicActions)
    .extend(walletActions);

export type ForkClient = ReturnType<typeof createForkClient>;
