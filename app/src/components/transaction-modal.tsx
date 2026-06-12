import { Dialog } from "@kobalte/core/dialog";
import { TbOutlineAlertTriangle, TbOutlineCheck, TbOutlineLoader, TbOutlineX } from "solid-icons/tb";
import { createMemo, For, Show } from "solid-js";

import { isPendingStep, type TxState, type TxStep } from "../hooks/useTransaction";

type TransactionModalProperties = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  state: TxState;
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

const StepIndicator = (properties: { active: boolean; completed: boolean; label: string; }) => (
  <div class="flex items-center gap-3">
    <div
      classList={{
        "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold": true,
        "border-blue-primary bg-blue-primary text-white": properties.active,
        "border-border text-text-secondary": !properties.active && !properties.completed,
        "border-green-primary bg-green-primary text-white": properties.completed,
      }}
    >
      <Show when={properties.completed} fallback={properties.active ? <TbOutlineLoader class="animate-spin" size={16} /> : ""}>
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

export const TransactionModal = (properties: TransactionModalProperties) => {
  const currentIndex = createMemo(() => stepIndex(properties.state.step));
  const isPending = createMemo(() => isPendingStep(properties.state.step));
  const progressPercent = createMemo(() => {
    if (properties.state.step === "success") return 100;

    return Math.max(0, currentIndex()) * (100 / (STEPS.length - 1));
  });
  const transactionHash = createMemo(() => ("hash" in properties.state ? properties.state.hash : undefined));

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
          <Dialog.Content class="dialog-content" data-testid="tx-modal">
            <Dialog.Title class="text-xl font-bold">{properties.title}</Dialog.Title>

            <Show when={properties.state.step !== "error"}>
              <div class="mt-6 space-y-4">
                <For each={STEPS.slice(0, -1)}>
                  {entry => (
                    <StepIndicator
                      active={properties.state.step === entry.step}
                      completed={currentIndex() > stepIndex(entry.step)}
                      label={entry.label}
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
                    <p class="font-bold text-green-primary">Transaction confirmed</p>
                    <p class="mt-1 text-sm text-text-secondary">Your changes are on chain.</p>
                  </div>
                </div>
              </div>
            </Show>

            <Show when={transactionHash()}>
              {hash => (
                <div class="mt-4 rounded-button bg-background-secondary px-4 py-3">
                  <p class="text-xs font-bold text-text-secondary">Transaction hash</p>
                  <a
                    class="mt-1 block truncate text-sm font-bold text-blue-primary hover:underline"
                    data-testid="tx-hash"
                    href={`https://etherscan.io/tx/${hash()}`}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {hash()}
                  </a>
                </div>
              )}
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
