import { Dialog } from "@kobalte/core/dialog";
import { TbOutlineAlertTriangle, TbOutlineCheck, TbOutlineLoader, TbOutlineX } from "solid-icons/tb";
import { createMemo, For, type JSX, Show } from "solid-js";
import { formatEther } from "viem/utils";

import { isPendingStep, type TxState, type TxStep } from "../hooks/useTransaction";

export type TransactionSummaryRow = {
  label: string;
  value: string;
};

type TransactionModalProperties = {
  children?: JSX.Element;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  state: TxState;
  summary?: TransactionSummaryRow[];
  title: string;
};

const STEPS: Array<{ label: string; step: TxStep; }> = [
  { label: "Preview", step: "preview" },
  { label: "Simulate", step: "simulating" },
  { label: "Sign", step: "waiting-for-signature" },
  { label: "Confirm", step: "confirming" },
  { label: "Done", step: "success" },
];

const stepIndex = (step: TxStep) => STEPS.findIndex(entry => entry.step === step);

const stepLabel = (step: TxStep) => STEPS.find(entry => entry.step === step)?.label ?? "";

const StepIndicator = (properties: { active: boolean; completed: boolean; label: string; pending: boolean; }) => (
  <div class="flex items-center gap-3">
    <div
      classList={{
        "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold": true,
        "border-blue-primary bg-blue-primary text-white": properties.active,
        "border-border text-text-secondary": !properties.active && !properties.completed,
        "border-green-primary bg-green-primary text-white": properties.completed,
      }}
    >
      <Show
        when={properties.completed}
        fallback={properties.active
          ? (properties.pending ? <TbOutlineLoader class="animate-spin" size={16} /> : <span aria-hidden="true">●</span>)
          : ""}
      >
        <TbOutlineCheck size={16} />
      </Show>
    </div>
    <span
      classList={{
        "text-sm font-bold": true,
        "text-text-primary": properties.active,
        "text-text-secondary": !properties.active,
      }}
    >
      {properties.label}
    </span>
  </div>
);

const formatFeeEth = (weiValues: bigint[]) => {
  const totalWei = weiValues.reduce((sum, wei) => sum + wei, 0n);

  return `~${Number(formatEther(totalWei)).toFixed(6)} ETH`;
};

export const TransactionModal = (properties: TransactionModalProperties) => {
  const currentIndex = createMemo(() => stepIndex(properties.state.step));
  const isPending = createMemo(() => isPendingStep(properties.state.step));
  const progress = createMemo(() => ("progress" in properties.state ? properties.state.progress : undefined));
  const hashes = createMemo(() => ("hashes" in properties.state ? properties.state.hashes : []));
  const feeWeiByTx = createMemo(() => ("feeWeiByTx" in properties.state ? properties.state.feeWeiByTx : []));

  const feeText = createMemo(() => {
    const fees = feeWeiByTx();

    if (fees.length === 0) return properties.state.step === "simulating" ? "Estimating…" : undefined;

    const suffix = (progress()?.total ?? 1) > 1 ? ` · ${fees.length} tx` : "";

    return `${formatFeeEth(fees)}${suffix}`;
  });
  const progressPercent = createMemo(() => {
    if (properties.state.step === "success") return 100;

    const sequence = progress() ?? { currentIndex: 0, total: 1 };
    const withinTx = Math.max(0, currentIndex()) / (STEPS.length - 1);

    return ((sequence.currentIndex + withinTx) / sequence.total) * 100;
  });

  return (
    <Dialog
      open={properties.isOpen}
      onOpenChange={(open) => {
        if (!open && !isPending()) properties.onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay class="dialog-overlay" />
        <div class="dialog-positioner">
          <Dialog.Content class="dialog-content max-h-[calc(100vh-2rem)] overflow-y-auto" data-testid="tx-modal">
            <Dialog.Title class="text-xl font-bold">{properties.title}</Dialog.Title>

            <Show when={(properties.summary?.length ?? 0) > 0 || feeText()}>
              <div class="mt-4 rounded-button bg-background-secondary px-4 py-3" data-testid="tx-summary">
                <For each={properties.summary ?? []}>
                  {row => (
                    <div class="flex items-baseline justify-between gap-4 py-0.5 text-sm">
                      <span class="shrink-0 font-bold text-text-secondary">{row.label}</span>
                      <span class="min-w-0 truncate text-right font-bold tabular-nums">{row.value}</span>
                    </div>
                  )}
                </For>
                <Show when={feeText()}>
                  {fee => (
                    <div class="flex items-baseline justify-between gap-4 py-0.5 text-sm" data-testid="tx-fee">
                      <span class="shrink-0 font-bold text-text-secondary">Estimated network fee</span>
                      <span class="min-w-0 truncate text-right font-bold tabular-nums">{fee()}</span>
                    </div>
                  )}
                </Show>
              </div>
            </Show>

            <Show when={properties.state.step === "preview"}>
              {properties.children}
            </Show>

            <Show when={isPending() && (progress()?.total ?? 1) > 1 && progress()}>
              {sequence => (
                <p class="mt-4 text-sm font-bold text-text-secondary">
                  Transaction
                  {" "}
                  {sequence().currentIndex + 1}
                  {" "}
                  of
                  {" "}
                  {sequence().total}
                  {" "}
                  ·
                  {" "}
                  {stepLabel(properties.state.step)}
                </p>
              )}
            </Show>

            <Show when={properties.state.step !== "error"}>
              <div class="mt-6 space-y-4">
                <For each={STEPS.slice(0, -1)}>
                  {entry => (
                    <StepIndicator
                      active={properties.state.step === entry.step}
                      completed={currentIndex() > stepIndex(entry.step)}
                      label={entry.label}
                      pending={isPending()}
                    />
                  )}
                </For>
              </div>
            </Show>

            <Show when={properties.state.step === "error" && properties.state}>
              {state => (
                <div class="mt-6 rounded-card border border-red-primary/20 bg-red-primary/5 p-4">
                  <div class="flex items-start gap-3">
                    <TbOutlineAlertTriangle class="mt-0.5 shrink-0 text-red-primary" size={20} />
                    <div>
                      <p class="font-bold text-red-primary">Transaction failed</p>
                      <p class="mt-1 break-words text-sm text-text-secondary">
                        {state().step === "error" ? state().error : undefined}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </Show>

            <Show when={properties.state.step === "success"}>
              <div class="mt-6 rounded-card border border-green-primary/20 bg-green-primary/5 p-4">
                <div class="flex items-start gap-3">
                  <TbOutlineCheck class="mt-0.5 shrink-0 text-green-primary" size={20} />
                  <div>
                    <p class="font-bold text-green-primary">
                      {hashes().length > 1 ? `All ${hashes().length} transactions confirmed` : "Transaction confirmed"}
                    </p>
                    <p class="mt-1 text-sm text-text-secondary">Your changes are on chain.</p>
                  </div>
                </div>
              </div>
            </Show>

            <Show when={hashes().length > 0}>
              <div class="mt-4 rounded-button bg-background-secondary px-4 py-3">
                <p class="text-xs font-bold text-text-secondary">
                  {hashes().length > 1 ? "Transaction hashes" : "Transaction hash"}
                </p>
                <For each={hashes()}>
                  {(hash, index) => (
                    <a
                      class="mt-1 block truncate text-sm font-bold text-blue-primary hover:underline"
                      data-testid={index() === 0 ? "tx-hash" : undefined}
                      href={`https://etherscan.io/tx/${hash}`}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {hash}
                    </a>
                  )}
                </For>
              </div>
            </Show>

            <Show when={progressPercent() > 0 && properties.state.step !== "error"}>
              <div class="mt-4 h-2 w-full overflow-hidden rounded-full bg-background-disabled">
                <div
                  class="h-full rounded-full bg-blue-primary transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent()}%` }}
                />
              </div>
            </Show>

            <div class="mt-6 flex justify-end gap-3">
              <Show when={properties.state.step === "error" || properties.state.step === "success"}>
                <Dialog.CloseButton class="button primary" data-testid="tx-done">
                  Done
                </Dialog.CloseButton>
              </Show>
              <Show when={properties.state.step === "preview"}>
                <button class="button primary" data-testid="tx-confirm" onClick={properties.onConfirm} type="button">
                  Confirm
                </button>
              </Show>
            </div>

            <Show when={!isPending()}>
              <Dialog.CloseButton aria-label="Close" class="icon-button small absolute right-4 top-4">
                <TbOutlineX size={20} />
              </Dialog.CloseButton>
            </Show>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
};
