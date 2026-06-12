import { useChainId, useClient } from "@wagmi/solid";
import { useQuery } from "@wagmi/solid/query";
import type { Accessor } from "solid-js";

import { fetchRenewalQuote, type RenewalQuote } from "../utils/renewal";

export const useRenewalQuote = (
  names: Accessor<string[]>,
  durationSeconds: Accessor<number>,
) => {
  const chainId = useChainId();
  const client = useClient(() => ({ chainId: chainId() }));

  return useQuery<RenewalQuote, Error, RenewalQuote, readonly ["renewalQuote", number, string, number]>(() => ({
    enabled: names().length > 0,
    queryFn: async () => {
      const publicClient = client();

      if (!publicClient) throw new Error("No client available");

      return await fetchRenewalQuote(publicClient, names(), durationSeconds());
    },
    queryKey: ["renewalQuote", chainId(), [...names()].sort().join(","), durationSeconds()] as const,
    refetchInterval: 60_000,
  }));
};
