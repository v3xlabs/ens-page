import { getWalletClient } from "@wagmi/core";
import { useChainId, useClient, useConnection } from "@wagmi/solid";
import { createSignal } from "solid-js";
import type { Address, Hex } from "viem";
import { call, waitForTransactionReceipt } from "viem/actions";

import { wagmiConfig } from "../config";

export type TxState =
  | { error: string; step: "error"; }
  | { hash: Hex; step: "confirming" | "success"; }
  | { step: "idle" | "preview" | "simulating" | "waiting-for-signature"; };

export type TxStep = TxState["step"];

export type TransactionRequest = {
  data: Hex;
  to: Address;
  value?: bigint;
};

const pendingSteps = new Set<TxStep>(["simulating", "waiting-for-signature", "confirming"]);

export const isPendingStep = (step: TxStep) => pendingSteps.has(step);

export const useTransaction = () => {
  const chainId = useChainId();
  const client = useClient(() => ({ chainId: chainId() }));
  const connection = useConnection();
  const [state, setState] = createSignal<TxState>({ step: "idle" });

  const preview = () => setState({ step: "preview" });

  const reset = () => setState({ step: "idle" });

  const send = async (request: TransactionRequest): Promise<Hex | undefined> => {
    const publicClient = client();
    const account = connection().address;

    if (!publicClient || !account) {
      setState({ error: "Connect a wallet first.", step: "error" });

      return;
    }

    try {
      setState({ step: "simulating" });
      await call(publicClient, { account, ...request });

      setState({ step: "waiting-for-signature" });
      const walletClient = await getWalletClient(wagmiConfig, { chainId: chainId() });
      const hash = await walletClient.sendTransaction({ account, ...request });

      setState({ hash, step: "confirming" });
      await waitForTransactionReceipt(publicClient, { hash });

      setState({ hash, step: "success" });

      return hash;
    }
    catch (error) {
      setState({
        error: error instanceof Error ? error.message : "Transaction failed",
        step: "error",
      });

      return;
    }
  };

  return { preview, reset, send, state };
};
