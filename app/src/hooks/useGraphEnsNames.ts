import { createMutation } from "@tanstack/solid-query";
import type { Address } from "viem";

import { useOwnedNames } from "./useOwnedNames";

// Subgraph-compatible ENSNode endpoint; the hosted service URL this used before was sunset.
const ENS_SUBGRAPH_URL = "https://api.alpha.ensnode.io/subgraph";

const OWNED_NAMES_QUERY = `
  query OwnedNames($owner: String!) {
    domains(where: { owner: $owner }, orderBy: name, orderDirection: asc) {
      name
      expiryDate
    }
  }
`;

type GraphDomain = {
  expiryDate: string | null;
  name: string;
};

type GraphResponse = {
  data?: { domains: GraphDomain[]; };
  errors?: Array<{ message: string; }>;
};

export const useGraphEnsNames = () => {
  const { setNamesForAddress } = useOwnedNames();

  const mutation = createMutation(() => ({
    mutationFn: async ({ address }: { address: Address; }) => {
      const response = await fetch(ENS_SUBGRAPH_URL, {
        body: JSON.stringify({
          query: OWNED_NAMES_QUERY,
          variables: { owner: address.toLowerCase() },
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) throw new Error(`Subgraph request failed: ${response.status}`);

      const json = (await response.json()) as GraphResponse;

      if (json.errors?.length) throw new Error(json.errors[0].message);

      return json.data?.domains ?? [];
    },
    onSuccess: (domains, { address }) => {
      const names = domains.map(domain => ({
        expiryDate: domain.expiryDate ? Number(domain.expiryDate) : 0,
        name: domain.name,
      }));

      setNamesForAddress(address, names);
    },
  }));

  return {
    error: () => mutation.error,
    fetchNames: (address: Address) => mutation.mutateAsync({ address }),
    isLoading: () => mutation.isPending,
  };
};
