import { useChainId, useClient } from "@wagmi/solid";
import { useQuery } from "@wagmi/solid/query";
import type { Accessor } from "solid-js";
import type { Address } from "viem";
import { getEnsAddress } from "viem/actions";

import { useNormalizedName } from "./useNormalizedName";

export type EnsAddressResult = {
  address?: Address;
};

export const useEnsAddress = (name: Accessor<string | undefined>) => {
  const chainId = useChainId();
  const client = useClient(() => ({ chainId: chainId() }));
  const normalizedName = useNormalizedName(name);

  return useQuery<EnsAddressResult, Error, EnsAddressResult, readonly ["ensAddress", number, string]>(() => ({
    enabled: Boolean(normalizedName()),
    queryFn: async () => {
      const publicClient = client();

      if (!publicClient) return {};

      return { address: await getEnsAddress(publicClient, { name: normalizedName() }) ?? undefined };
    },
    queryKey: ["ensAddress", chainId(), normalizedName()] as const,
    suspense: true,
  }));
};
