import { useClient } from "@wagmi/solid";
import { mainnet } from "@wagmi/solid/chains";
import { useQuery } from "@wagmi/solid/query";
import type { Accessor } from "solid-js";
import type { Address } from "viem";
import { getEnsName as getViemEnsName } from "viem/actions";

export const useEnsName = (address: Accessor<Address | undefined>) => {
  const client = useClient(() => ({ chainId: mainnet["id"] }));

  return useQuery<string | undefined, Error, string | undefined, readonly ["ensName", Address | undefined]>(() => ({
    queryKey: ["ensName", address()] as const,
    enabled: Boolean(address()),
    queryFn: async () => {
      const publicClient = client();
      const value = address();

      if (!publicClient || !value) return;

      return await getViemEnsName(publicClient, { address: value }) ?? undefined;
    },
  }));
};
