import { useChainId, useClient } from "@wagmi/solid";
import { useQuery } from "@wagmi/solid/query";
import { getBlockNumber } from "viem/actions";

// Lightweight liveness probe for the active chain's RPC. Never retries and
// re-checks on an interval, so a dead endpoint is flagged within one timeout
// and recovers automatically when the endpoint comes back.
export const useChainHealth = () => {
  const chainId = useChainId();
  const client = useClient(() => ({ chainId: chainId() }));

  return useQuery<boolean, Error, boolean, readonly ["chainHealth", number]>(() => ({
    queryFn: async () => {
      const publicClient = client();

      if (!publicClient) return false;

      await getBlockNumber(publicClient);

      return true;
    },
    queryKey: ["chainHealth", chainId()] as const,
    refetchInterval: 10_000,
    retry: false,
    staleTime: 5000,
  }));
};
