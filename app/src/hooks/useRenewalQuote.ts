import { keepPreviousData } from "@tanstack/solid-query";
import { useChainId, useClient } from "@wagmi/solid";
import { useQuery } from "@wagmi/solid/query";
import type { Accessor } from "solid-js";

import { fetchRenewalQuote, type RenewalQuote } from "../utils/renewal";
import type { PriceTier } from "./useCart";

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
    // Keep the previous quote rendered while a selection change re-quotes, so
    // totals never blank out mid-interaction; confirm re-quotes fresh anyway.
    placeholderData: keepPreviousData,
    queryKey: ["renewalQuote", chainId(), [...names()].sort().join(","), durationSeconds()] as const,
    refetchInterval: 60_000,
    staleTime: 30_000,
  }));
};

// A mixed-tier selection needs one rentPrice quote per tier; the tier set is
// closed, so a fixed query per tier (disabled while that tier is empty) keeps
// hook creation static while the selection changes.
export const useTierRenewalQuotes = (
  namesByTier: Accessor<Record<PriceTier, string[]>>,
  durationSeconds: Accessor<number>,
) => ({
  "3char": useRenewalQuote(() => namesByTier()["3char"], durationSeconds),
  "4char": useRenewalQuote(() => namesByTier()["4char"], durationSeconds),
  "standard": useRenewalQuote(() => namesByTier().standard, durationSeconds),
});
