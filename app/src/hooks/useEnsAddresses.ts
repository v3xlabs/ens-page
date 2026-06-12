import { useChainId, useClient } from "@wagmi/solid";
import { useQuery } from "@wagmi/solid/query";
import type { Accessor } from "solid-js";
import { getEnsAddress } from "viem/actions";
import { hexToBytes, isHex } from "viem/utils";

import { defaultAddressRecords } from "../utils/records";
import { useNormalizedName } from "./useNormalizedName";

export type EnsAddressRecord = {
  coinType: bigint;
  decoded?: string;
  key: string;
  label: string;
  value?: string;
};

const ETH_COIN_TYPE = 60n;

const decodeAddressValue = async (coinType: bigint, value: string) => {
  if (coinType === ETH_COIN_TYPE || !isHex(value)) return value;

  try {
    const { getCoderByCoinType } = await import("@ensdomains/address-encoder");

    return getCoderByCoinType(Number(coinType)).encode(hexToBytes(value));
  }
  catch {
    return value;
  }
};

export const useEnsAddresses = (name: Accessor<string | undefined>) => {
  const chainId = useChainId();
  const client = useClient(() => ({ chainId: chainId() }));
  const normalizedName = useNormalizedName(name);

  return useQuery<EnsAddressRecord[], Error, EnsAddressRecord[], readonly ["ensAddresses", number, string]>(() => ({
    enabled: Boolean(normalizedName()),
    queryFn: async (): Promise<EnsAddressRecord[]> => {
      const publicClient = client();

      if (!publicClient) return [];

      return await Promise.all(defaultAddressRecords.map(async (record) => {
        const value = await getEnsAddress(publicClient, {
          coinType: record.coinType,
          name: normalizedName(),
        }).catch(() => {});

        if (!value) return { coinType: record.coinType, key: record.key, label: record.label };

        return {
          coinType: record.coinType,
          decoded: await decodeAddressValue(record.coinType, value),
          key: record.key,
          label: record.label,
          value,
        };
      }));
    },
    queryKey: ["ensAddresses", chainId(), normalizedName()] as const,
    suspense: true,
  }));
};
