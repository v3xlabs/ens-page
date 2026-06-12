import { useChainId, useClient } from "@wagmi/solid";
import { useQuery } from "@wagmi/solid/query";
import type { Accessor } from "solid-js";
import { getEnsAvatar } from "viem/actions";

import { resolveIpfsUri } from "../utils/ens";
import { useNormalizedName } from "./useNormalizedName";

export type EnsAvatarResult = {
  avatar?: string;
};

export const useEnsAvatar = (name: Accessor<string | undefined>) => {
  const chainId = useChainId();
  const client = useClient(() => ({ chainId: chainId() }));
  const normalizedName = useNormalizedName(name);

  return useQuery<EnsAvatarResult, Error, EnsAvatarResult, readonly ["ensAvatar", number, string]>(() => ({
    enabled: Boolean(normalizedName()),
    queryFn: async () => {
      const publicClient = client();

      if (!publicClient) return {};

      const avatar = await getEnsAvatar(publicClient, { name: normalizedName() });

      return { avatar: avatar ? resolveIpfsUri(avatar) : undefined };
    },
    queryKey: ["ensAvatar", chainId(), normalizedName()] as const,
    suspense: true,
  }));
};
