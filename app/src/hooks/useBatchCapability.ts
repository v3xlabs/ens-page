import { getWalletClient } from "@wagmi/core";
import { useChainId, useConnection } from "@wagmi/solid";
import { createSignal } from "solid-js";
import { getCapabilities } from "viem/actions";

import { wagmiConfig } from "../config";

export const useBatchCapability = () => {
  const chainId = useChainId();
  const connection = useConnection();
  const [supportsBatch, setSupportsBatch] = createSignal<boolean>();

  const checkSupport = async () => {
    const account = connection().address;

    if (!account) {
      setSupportsBatch(false);

      return false;
    }

    try {
      const walletClient = await getWalletClient(wagmiConfig, { chainId: chainId() });
      const capabilities = await getCapabilities(walletClient, { account, chainId: chainId() });
      const status = capabilities.atomic?.status;
      const supported = status === "supported" || status === "ready";

      setSupportsBatch(supported);

      return supported;
    }
    catch {
      setSupportsBatch(false);

      return false;
    }
  };

  return { checkSupport, supportsBatch };
};
