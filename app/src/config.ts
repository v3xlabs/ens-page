import { injected } from "@wagmi/connectors";
import { createConfig, http } from "@wagmi/solid";
import { foundry, mainnet, sepolia } from "@wagmi/solid/chains";
import { type Address, getAddress, isAddress } from "viem";

const mainnetRpcUrl
  = import.meta.env.VITE_MAINNET_RPC_URL ?? "https://ethereum.reth.rs/rpc";

const anvilRpcUrl = import.meta.env.VITE_ANVIL_RPC_URL;

export const isAnvilEnabled = Boolean(anvilRpcUrl);

const parseAddress = (value: string | undefined): Address | undefined =>
  (value && isAddress(value) ? getAddress(value) : undefined);

export const renewalPoolFactoryAddress = parseAddress(import.meta.env.VITE_RENEWAL_POOL_FACTORY_ADDRESS);

// Seed scripts deploy pools whose labels live off-chain; the fork recipe hands
// them to the app as "address:label;address:label".
const parseSeedPoolLabels = (raw: string | undefined): Record<string, string> => {
  if (!raw) return {};

  return Object.fromEntries(
    raw
      .split(";")
      .map((entry): [string, string] | undefined => {
        const separator = entry.indexOf(":");

        if (separator <= 0) return;

        const address = entry.slice(0, separator);
        const label = entry.slice(separator + 1).trim();

        if (!isAddress(address) || !label) return;

        return [address.toLowerCase(), label];
      })
      .filter((pair): pair is [string, string] => pair !== undefined),
  );
};

export const seedPoolLabels = parseSeedPoolLabels(import.meta.env.VITE_SEED_POOL_LABELS);

// A local mainnet fork carries the mainnet ENS deployment at the same
// addresses, but viem's foundry chain doesn't declare them — graft them on so
// ENS reads work when the wallet is on chain 31337.
export const anvilChain = {
  ...foundry,
  contracts: {
    ...foundry.contracts,
    ensUniversalResolver: mainnet.contracts.ensUniversalResolver,
    multicall3: mainnet.contracts.multicall3,
  },
  name: "Anvil fork",
} as const;

export const supportedChains = [mainnet, sepolia, anvilChain] as const;

export const wagmiConfig = createConfig({
  chains: supportedChains,
  connectors: [injected()],
  transports: {
    [mainnet["id"]]: http(mainnetRpcUrl, { batch: true }),
    [sepolia["id"]]: http(),
    // A local fork is either up or gone — fail fast so a dead anvil never
    // leaves queries retrying for minutes.
    [anvilChain["id"]]: http(anvilRpcUrl ?? "http://127.0.0.1:8545", { retryCount: 0, timeout: 3000 }),
  },
});
