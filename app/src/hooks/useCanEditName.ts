import { useChainId, useClient, useConnection } from "@wagmi/solid";
import { useQuery } from "@wagmi/solid/query";
import type { Accessor } from "solid-js";
import type { Address } from "viem";
import { call, getEnsResolver } from "viem/actions";

import { prepareSetTexts } from "../utils/ens";
import { useNormalizedName } from "./useNormalizedName";

// Editing rights vary by resolver implementation (owner, controller, or approved
// operator), so instead of replicating each resolver's ACL we simulate a setText
// from the connected account and let the resolver itself answer.
export const useCanEditName = (name: Accessor<string | undefined>) => {
  const chainId = useChainId();
  const client = useClient(() => ({ chainId: chainId() }));
  const connection = useConnection();
  const normalizedName = useNormalizedName(name);

  return useQuery<boolean, Error, boolean, readonly ["canEditName", number, string, Address | undefined]>(() => ({
    enabled: Boolean(normalizedName()) && Boolean(connection().address),
    queryFn: async () => {
      const publicClient = client();
      const account = connection().address;

      if (!publicClient || !account) return false;

      const resolver = await getEnsResolver(publicClient, { name: normalizedName() })
        .catch(() => {});

      if (!resolver) return false;

      const probe = prepareSetTexts(normalizedName(), resolver, [
        { key: "description", value: "" },
      ]);

      try {
        await call(publicClient, { account, ...probe });

        return true;
      }
      catch {
        return false;
      }
    },
    queryKey: ["canEditName", chainId(), normalizedName(), connection().address] as const,
  }));
};
