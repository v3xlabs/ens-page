import { useChainId, useClient } from "@wagmi/solid";
import { useQuery } from "@wagmi/solid/query";
import type { Accessor } from "solid-js";
import { getEnsText } from "viem/actions";

import { defaultTextRecords } from "../utils/records";
import { useNormalizedName } from "./useNormalizedName";

export type EnsTextRecord = {
  key: string;
  label: string;
  value?: string;
};

export const useEnsTexts = (name: Accessor<string | undefined>) => {
  const chainId = useChainId();
  const client = useClient(() => ({ chainId: chainId() }));
  const normalizedName = useNormalizedName(name);

  return useQuery<EnsTextRecord[], Error, EnsTextRecord[], readonly ["ensTexts", number, string]>(() => ({
    enabled: Boolean(normalizedName()),
    queryFn: async (): Promise<EnsTextRecord[]> => {
      const publicClient = client();

      if (!publicClient) return [];

      return await Promise.all(defaultTextRecords.map(async (record) => {
        const value = await getEnsText(publicClient, { key: record.key, name: normalizedName() })
          .catch(() => {});

        return { key: record.key, label: record.label, value: value ?? undefined };
      }));
    },
    queryKey: ["ensTexts", chainId(), normalizedName()] as const,
    suspense: true,
  }));
};
