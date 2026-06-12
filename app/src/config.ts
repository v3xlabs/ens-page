import { injected } from "@wagmi/connectors";
import { createConfig, http } from "@wagmi/solid";
import { mainnet, sepolia } from "@wagmi/solid/chains";

export const supportedChains = [mainnet, sepolia] as const;

export const wagmiConfig = createConfig({
  chains: supportedChains,
  connectors: [injected()],
  transports: {
    [mainnet["id"]]: http("https://ethereum.reth.rs/rpc"),
    [sepolia["id"]]: http(),
  },
});

export const shortenAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;
