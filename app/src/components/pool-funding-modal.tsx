import { Show } from "solid-js";

import { type TxState } from "../hooks/useTransaction";
import { t } from "../i18n";
import { TransactionModal, type TransactionSummaryRow } from "./transaction-modal";

type PoolFundingModalProperties = {
  action: "deposit" | "withdraw";
  amount: string;
  isOpen: boolean;
  onAmountInput: (amount: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  state: TxState;
  summary?: TransactionSummaryRow[];
};

export const PoolFundingModal = (properties: PoolFundingModalProperties) => (
  <TransactionModal
    isOpen={properties.isOpen}
    onClose={properties.onClose}
    onConfirm={properties.onConfirm}
    state={properties.state}
    summary={properties.summary}
    title={properties.action === "deposit" ? t("pools.fund") : t("pools.withdrawFromPool")}
  >
    <div class="mt-4 space-y-4">
      <Show when={properties.action === "deposit"}>
        <div class="rounded-button border border-border bg-background-secondary p-3">
          <p class="font-bold">ETH</p>
        </div>
      </Show>
      <label class="block text-sm font-bold text-text-secondary" for="pool-funding-amount">{t("pools.amountInEth")}</label>
      <input
        class="input tabular-nums"
        data-testid="pool-funding-amount"
        id="pool-funding-amount"
        min="0"
        onInput={event => properties.onAmountInput(event.currentTarget.value)}
        placeholder="0.00"
        step="any"
        type="number"
        value={properties.amount}
      />
      <Show when={properties.action === "withdraw"}>
        <p class="text-sm text-text-secondary">{t("pools.fundsReturn")}</p>
      </Show>
    </div>
  </TransactionModal>
);
