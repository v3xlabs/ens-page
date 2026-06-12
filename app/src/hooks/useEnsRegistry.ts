import { useChainId, useClient } from "@wagmi/solid";
import { useQuery } from "@wagmi/solid/query";
import type { Accessor } from "solid-js";
import type { Address } from "viem";
import { getEnsResolver } from "viem/actions";

import { ENS_REGISTRY_ADDRESS } from "../utils/ens";
import { useNormalizedName } from "./useNormalizedName";

export type EnsRegistryResult = {
  registry?: Address;
  resolver?: Address;
};

export const useEnsRegistry = (name: Accessor<string | undefined>) => {
  const chainId = useChainId();
  const client = useClient(() => ({ chainId: chainId() }));
  const normalizedName = useNormalizedName(name);

  return useQuery<EnsRegistryResult, Error, EnsRegistryResult, readonly ["ensRegistry", number, string]>(() => ({
    enabled: Boolean(normalizedName()),
    queryFn: async () => {
      const publicClient = client();

      if (!publicClient) return {};

      const resolver = await getEnsResolver(publicClient, { name: normalizedName() })
        .catch(() => {});

      return { registry: ENS_REGISTRY_ADDRESS, resolver };
    },
    queryKey: ["ensRegistry", chainId(), normalizedName()] as const,
    suspense: true,
  }));
};
