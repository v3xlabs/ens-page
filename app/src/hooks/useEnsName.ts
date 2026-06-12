import { useChainId, useClient } from "@wagmi/solid";
import { useQuery } from "@wagmi/solid/query";
import type { Accessor } from "solid-js";
import type { Address } from "viem";
import { getEnsName } from "viem/actions";

export type EnsNameResult = {
  name?: string;
};

export const useEnsName = (address: Accessor<Address | undefined>) => {
  const chainId = useChainId();
  const client = useClient(() => ({ chainId: chainId() }));

  return useQuery<EnsNameResult, Error, EnsNameResult, readonly ["ensName", number, Address | undefined]>(() => ({
    enabled: Boolean(address()),
    queryFn: async () => {
      const publicClient = client();
      const value = address();

      if (!publicClient || !value) return {};

      return { name: await getEnsName(publicClient, { address: value }) ?? undefined };
    },
    queryKey: ["ensName", chainId(), address()] as const,
  }));
};
