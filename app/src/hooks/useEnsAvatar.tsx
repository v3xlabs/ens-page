import { useClient } from "@wagmi/solid";
import { mainnet } from "@wagmi/solid/chains";
import { useQuery } from "@wagmi/solid/query";
import type { Accessor } from "solid-js";
import { getEnsAvatar as getViemEnsAvatar } from "viem/actions";

import { useNormalizedName } from "./useNormalizedName";

export const useEnsAvatar = (name: Accessor<string | undefined>) => {
  const client = useClient(() => ({ chainId: mainnet["id"] }));
  const normalizedName = useNormalizedName(name);

  return useQuery<string | undefined, Error, string | undefined, readonly ["ensAvatar", string]>(() => ({
    queryKey: ["ensAvatar", normalizedName()] as const,
    enabled: Boolean(normalizedName()),
    queryFn: async () => {
      const publicClient = client();

      if (!publicClient) return;

      return await getViemEnsAvatar(publicClient, { name: normalizedName() }) ?? undefined;
    },
  }));
};
