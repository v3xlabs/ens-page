import { getWalletClient } from "@wagmi/core";
import { useChainId, useClient, useConnection } from "@wagmi/solid";
import { createSignal } from "solid-js";
import type { Address, Hex } from "viem";
import { call, estimateFeesPerGas, estimateGas, getGasPrice, waitForTransactionReceipt } from "viem/actions";

import { wagmiConfig } from "../config";

export type TxProgress = {
  currentIndex: number;
  total: number;
};

export type TxState =
  | { error: string; feeWeiByTx: bigint[]; hashes: Hex[]; step: "error"; }
  | { feeWeiByTx: bigint[]; hashes: Hex[]; progress: TxProgress; step: "confirming" | "simulating" | "success" | "waiting-for-signature"; }
  | { step: "idle" | "preview"; };

export type TxStep = TxState["step"];

export type TransactionRequest = {
  data: Hex;
  to: Address;
  value?: bigint;
};

export type SequenceCallbacks = {
  onTransactionConfirmed?: (index: number) => void;
  onTransactionSent?: (hash: Hex, index: number) => void;
  onTransactionStarted?: (index: number) => void;
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

  // Executes each request as its own simulate → sign → wait-for-receipt cycle,
  // surfacing which transaction of the sequence is in flight via progress.
  // Builders run lazily under the "simulating" step so callers can re-quote
  // prices immediately before each transaction is sent.
  const sendSequence = async (
    buildRequests: Array<() => Promise<TransactionRequest>>,
    callbacks?: SequenceCallbacks,
  ): Promise<Hex[] | undefined> => {
    if (buildRequests.length === 0) return;

    const publicClient = client();
    const account = connection().address;

    if (!publicClient || !account) {
      setState({ error: "Connect a wallet first.", feeWeiByTx: [], hashes: [], step: "error" });

      return;
    }

    const total = buildRequests.length;
    const hashes: Hex[] = [];
    const feeWeiByTx: bigint[] = [];

    const estimateFeeWei = async (request: TransactionRequest & { account: Address; }): Promise<bigint | undefined> => {
      try {
        const gasLimit = await estimateGas(publicClient, request);
        const perGasWei = await estimateFeesPerGas(publicClient)
          .then(fees => fees.maxFeePerGas)
          .catch(() => getGasPrice(publicClient));

        return gasLimit * perGasWei;
      }
      catch {
        // The fee readout is informational — never block the flow on it.
        return;
      }
    };

    try {
      for (const [index, buildRequest] of buildRequests.entries()) {
        const progress = { currentIndex: index, total };

        callbacks?.onTransactionStarted?.(index);
        setState({ feeWeiByTx: [...feeWeiByTx], hashes: [...hashes], progress, step: "simulating" });

        const request = await buildRequest();

        await call(publicClient, { account, ...request });

        const feeWei = await estimateFeeWei({ account, ...request });

        if (feeWei !== undefined) feeWeiByTx.push(feeWei);

        setState({ feeWeiByTx: [...feeWeiByTx], hashes: [...hashes], progress, step: "waiting-for-signature" });
        const walletClient = await getWalletClient(wagmiConfig, { chainId: chainId() });
        const hash = await walletClient.sendTransaction({ account, ...request });

        hashes.push(hash);
        callbacks?.onTransactionSent?.(hash, index);
        setState({ feeWeiByTx: [...feeWeiByTx], hashes: [...hashes], progress, step: "confirming" });

        await waitForTransactionReceipt(publicClient, { hash });
        callbacks?.onTransactionConfirmed?.(index);
      }

      setState({
        feeWeiByTx: [...feeWeiByTx],
        hashes: [...hashes],
        progress: { currentIndex: total - 1, total },
        step: "success",
      });

      return hashes;
    }
    catch (error) {
      setState({
        error: error instanceof Error ? error.message : "Transaction failed",
        feeWeiByTx: [...feeWeiByTx],
        hashes: [...hashes],
        step: "error",
      });

      return;
    }
  };

  const send = async (request: TransactionRequest): Promise<Hex | undefined> => {
    const hashes = await sendSequence([() => Promise.resolve(request)]);

    return hashes?.[0];
  };

  return { preview, reset, send, sendSequence, state };
};
