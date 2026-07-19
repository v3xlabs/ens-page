import { useChainId, useClient } from "@wagmi/solid";
import { useQuery } from "@wagmi/solid/query";
import type { Accessor } from "solid-js";
import type { Address } from "viem";
import { labelhash, zeroAddress } from "viem";
import { readContract } from "viem/actions";

import { BASE_REGISTRAR_ADDRESS } from "../utils/ens";
import { useNormalizedName } from "./useNormalizedName";

const baseRegistrarAbi = [
  {
    inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
    name: "ownerOf",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const isSecondLevelEth = (name: string) => name.endsWith(".eth") && name.split(".").length === 2;

/** The .eth registrar NFT holder — the account that actually owns a 2LD.
 * The zero address means "no registrant": a non-2LD, or an expired name
 * (ownerOf reverts). */
export const useNameRegistrant = (name: Accessor<string | undefined>) => {
  const chainId = useChainId();
  const client = useClient(() => ({ chainId: chainId() }));
  const normalizedName = useNormalizedName(name);

  return useQuery<Address, Error, Address, readonly ["nameRegistrant", number, string]>(() => ({
    enabled: Boolean(normalizedName()) && isSecondLevelEth(normalizedName()),
    queryFn: async () => {
      const publicClient = client();
      const value = normalizedName();

      if (!publicClient || !isSecondLevelEth(value)) return zeroAddress;

      const label = value.slice(0, -4);

      return readContract(publicClient, {
        abi: baseRegistrarAbi,
        address: BASE_REGISTRAR_ADDRESS,
        args: [BigInt(labelhash(label))],
        functionName: "ownerOf",
      }).catch(() => zeroAddress);
    },
    queryKey: ["nameRegistrant", chainId(), normalizedName()] as const,
  }));
};
