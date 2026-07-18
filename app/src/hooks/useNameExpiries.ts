import { useChainId, useClient } from "@wagmi/solid";
import { useQuery } from "@wagmi/solid/query";
import type { Accessor } from "solid-js";
import type { Address } from "viem";
import { readContract } from "viem/actions";
import { labelhash } from "viem/ens";

import { labelFor } from "../utils/renewal";

export const BASE_REGISTRAR_ADDRESS: Address = "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85";

const NAME_EXPIRES_ABI = [
  {
    inputs: [{ internalType: "uint256", name: "id", type: "uint256" }],
    name: "nameExpires",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Expiry per .eth name in unix seconds; 0 when unregistered or unknown.
export const useNameExpiries = (names: Accessor<string[]>) => {
  const chainId = useChainId();
  const client = useClient(() => ({ chainId: chainId() }));

  return useQuery<Record<string, number>, Error, Record<string, number>, readonly ["nameExpiries", number, string]>(() => ({
    enabled: names().length > 0,
    queryFn: async (): Promise<Record<string, number>> => {
      const publicClient = client();

      if (!publicClient) return {};

      const uniqueNames = [...new Set(names())];

      const entries = await Promise.all(uniqueNames.map(async (name) => {
        const expiry = await readContract(publicClient, {
          abi: NAME_EXPIRES_ABI,
          address: BASE_REGISTRAR_ADDRESS,
          args: [BigInt(labelhash(labelFor(name)))],
          functionName: "nameExpires",
        }).catch(() => 0n);

        return [name, Number(expiry ?? 0n)] as const;
      }));

      return Object.fromEntries(entries);
    },
    queryKey: ["nameExpiries", chainId(), [...names()].sort().join(",")] as const,
  }));
};
