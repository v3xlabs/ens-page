import { injected } from "@wagmi/connectors";
import { createConfig, http } from "@wagmi/solid";
import { mainnet, sepolia } from "@wagmi/solid/chains";

export const supportedChains = [mainnet, sepolia] as const;

const mainnetRpcUrl
  = import.meta.env.VITE_MAINNET_RPC_URL ?? "https://ethereum.reth.rs/rpc";

export const wagmiConfig = createConfig({
  chains: supportedChains,
  connectors: [injected()],
  transports: {
    [mainnet["id"]]: http(mainnetRpcUrl, { batch: true }),
    [sepolia["id"]]: http(),
  },
});
