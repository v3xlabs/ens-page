import { useClient } from "@wagmi/solid";
import { mainnet } from "@wagmi/solid/chains";
import { useQuery } from "@wagmi/solid/query";
import type { Accessor } from "solid-js";
import type { Address } from "viem";
import { getEnsAddress as getViemEnsAddress } from "viem/actions";

import { useNormalizedName } from "./useNormalizedName";

export const useEnsAddress = (name: Accessor<string | undefined>) => {
  const client = useClient(() => ({ chainId: mainnet["id"] }));
  const normalizedName = useNormalizedName(name);

  return useQuery<Address | undefined, Error, Address | undefined, readonly ["ensAddress", string]>(() => ({
    queryKey: ["ensAddress", normalizedName()] as const,
    enabled: Boolean(normalizedName()),
    queryFn: async () => {
      const publicClient = client();

      if (!publicClient) return;

      return await getViemEnsAddress(publicClient, { name: normalizedName() }) ?? undefined;
    },
  }));
};
