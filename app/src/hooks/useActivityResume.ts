import { useChainId, useClient } from "@wagmi/solid";
import { createSignal, onMount } from "solid-js";
import type { Hex } from "viem";
import { waitForTransactionReceipt } from "viem/actions";

import { useActivityLog } from "./useActivityLog";

const ABANDONED_AFTER_MS = 24 * 60 * 60 * 1000;
const RECEIPT_TIMEOUT_MS = 20_000;
const ABANDONED_DETAIL = "abandoned — restart the flow";

const [handledActivityIds, setHandledActivityIds] = createSignal<ReadonlySet<string>>(new Set());

const markHandled = (activityId: string) => {
  setHandledActivityIds((previous) => {
    const next = new Set(previous);

    next.add(activityId);

    return next;
  });
};

const unmarkHandled = (activityId: string) => {
  setHandledActivityIds((previous) => {
    const next = new Set(previous);

    next.delete(activityId);

    return next;
  });
};

const isHex = (value: string): value is Hex => value.startsWith("0x");

export const useActivityResume = () => {
  const chainId = useChainId();
  const client = useClient(() => ({ chainId: chainId() }));
  const { inProgress, updateActivity } = useActivityLog();

  const settle = (activityId: string, status: "failed" | "success", detail?: string) => {
    const stepStatus = status === "success" ? "done" : "failed";

    updateActivity(activityId, entry => ({
      ...entry,
      detail: detail ?? entry.detail,
      status,
      steps: entry.steps.map(step => (step.status === "active" ? { ...step, status: stepStatus } : step)),
    }));
  };

  const watchReceipt = async (activityId: string, hash: Hex, isStale: boolean) => {
    const publicClient = client();

    if (!publicClient) {
      unmarkHandled(activityId);

      return;
    }

    try {
      const receipt = await waitForTransactionReceipt(publicClient, { hash, timeout: RECEIPT_TIMEOUT_MS });

      if (receipt.status === "success") settle(activityId, "success");
      else settle(activityId, "failed", "transaction reverted");
    }
    catch {
      if (isStale) {
        settle(activityId, "failed", ABANDONED_DETAIL);

        return;
      }

      unmarkHandled(activityId);
    }
  };

  onMount(() => {
    const now = Date.now();

    for (const entry of inProgress()) {
      if (handledActivityIds().has(entry.activityId)) continue;

      const lastHash = entry.txHashes.at(-1);
      const hasActiveStep = entry.steps.some(step => step.status === "active");
      const isStale = now - entry.createdAtMs > ABANDONED_AFTER_MS;
      const watchableHash = lastHash !== undefined && isHex(lastHash) && hasActiveStep
        ? lastHash
        : undefined;

      if (watchableHash) {
        markHandled(entry.activityId);
        void watchReceipt(entry.activityId, watchableHash, isStale);
      }
      else if (isStale) {
        settle(entry.activityId, "failed", ABANDONED_DETAIL);
      }
    }
  });
};
