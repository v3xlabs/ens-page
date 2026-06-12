import { useClient } from "@wagmi/solid";
import { TbOutlineShoppingCart, TbOutlineTrash } from "solid-icons/tb";
import { createMemo, createSignal, For, Show } from "solid-js";
import { formatEther } from "viem/utils";

import { useBatchCapability } from "../hooks/useBatchCapability";
import { PRICE_PER_YEAR_USD, useCart } from "../hooks/useCart";
import { useRenewalQuote } from "../hooks/useRenewalQuote";
import { useTransaction } from "../hooks/useTransaction";
import { fetchRenewalQuote, prepareRenewAll, SECONDS_PER_YEAR } from "../utils/renewal";
import { TransactionModal } from "./transaction-modal";

const formatExpiry = (timestamp: number) => {
  const date = new Date(timestamp * 1000);

  return date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
};

const formatEth = (wei: bigint) => {
  const eth = Number(formatEther(wei));

  return `${eth.toLocaleString("en-US", { maximumFractionDigits: 5 })} ETH`;
};

export const RenewCart = () => {
  const {
    cartCount,
    cartItems,
    clearCart,
    isValidSelection,
    removeItem,
    selectedTier,
  } = useCart();

  const { checkSupport, supportsBatch } = useBatchCapability();
  const transaction = useTransaction();
  const client = useClient();

  const [showModal, setShowModal] = createSignal(false);
  const [durationYears, setDurationYears] = createSignal(1);

  const cartNames = createMemo(() => cartItems().map(item => item.name));
  const durationSeconds = createMemo(() => durationYears() * SECONDS_PER_YEAR);
  const quote = useRenewalQuote(cartNames, durationSeconds);

  const canProceed = createMemo(() => cartCount() > 0 && isValidSelection() && Boolean(quote.data));

  const handleCheckout = () => {
    if (!canProceed()) return;

    transaction.preview();
    setShowModal(true);
    void checkSupport().catch(() => false);
  };

  const handleConfirm = async () => {
    const publicClient = client();
    const names = cartNames();

    if (!publicClient || names.length === 0 || !isValidSelection()) return;

    // Re-quote right before sending so an oracle price update between adding
    // to cart and confirming cannot make the renewal underpay and revert.
    const freshQuote = await fetchRenewalQuote(publicClient, names, durationSeconds());
    const hash = await transaction.send(prepareRenewAll(names, durationSeconds(), freshQuote.pricePerNameWei));

    if (hash) clearCart();
  };

  const handleClose = () => {
    setShowModal(false);
    transaction.reset();
  };

  return (
    <>
      <div class="card p-5 sm:p-6">
        <div class="flex items-center justify-between">
          <span class="tag blue">Cart</span>
          <TbOutlineShoppingCart class="text-text-secondary" size={20} />
        </div>

        <h3 class="mt-4 text-xl font-bold">Renewal Cart</h3>

        <Show
          when={cartCount() > 0}
          fallback={<p class="mt-3 text-text-secondary">Select names from your list to add them to the renewal cart.</p>}
        >
          <div class="mt-4 space-y-3">
            <For each={cartItems()}>
              {item => (
                <div class="flex items-center justify-between rounded-button bg-background-secondary px-4 py-3">
                  <div class="min-w-0">
                    <p class="truncate font-bold">{item.name}</p>
                    <p class="text-xs text-text-secondary">
                      Expires
                      {" "}
                      {formatExpiry(item.expiryDate)}
                    </p>
                  </div>
                  <button
                    class="icon-button small"
                    onClick={() => removeItem(item.name)}
                    title="Remove from cart"
                    type="button"
                  >
                    <TbOutlineTrash size={14} />
                  </button>
                </div>
              )}
            </For>
          </div>
        </Show>

        <Show when={cartCount() > 0 && !isValidSelection()}>
          <div class="mt-4 rounded-card border border-red-primary/20 bg-red-primary/5 p-3">
            <p class="text-sm text-red-primary">
              All names must be in the same price tier (same character length category).
            </p>
          </div>
        </Show>

        <Show when={cartCount() > 0}>
          <div class="mt-4 space-y-3">
            <div>
              <label class="mb-1 block text-sm font-bold text-text-secondary" for="duration">
                Duration
              </label>
              <select
                class="w-full rounded-button border border-border bg-background-secondary px-4 py-3 text-text-primary"
                data-testid="cart-duration"
                id="duration"
                onChange={event => setDurationYears(Number(event.currentTarget.value))}
                value={durationYears()}
              >
                <option value={1}>1 year</option>
                <option value={2}>2 years</option>
                <option value={3}>3 years</option>
                <option value={5}>5 years</option>
                <option value={10}>10 years</option>
              </select>
            </div>

            <div class="rounded-button bg-background-secondary px-4 py-3">
              <div class="flex items-center justify-between">
                <span class="text-sm text-text-secondary">
                  {cartCount()}
                  {" "}
                  name
                  {cartCount() === 1 ? "" : "s"}
                  <Show when={selectedTier()}>
                    {tier => (
                      <span class="ml-2 text-xs">
                        ($
                        {PRICE_PER_YEAR_USD[tier()]}
                        /yr each)
                      </span>
                    )}
                  </Show>
                </span>
                <span class="text-lg font-bold" data-testid="cart-total">
                  <Show when={quote.data} fallback="…">
                    {renewalQuote => formatEth(renewalQuote().totalWei)}
                  </Show>
                </span>
              </div>
            </div>

            <div class="flex gap-2">
              <button class="button subtle flex-1" data-testid="cart-clear" onClick={clearCart} type="button">
                Clear
              </button>
              <button
                class="button primary flex-1"
                data-testid="cart-review"
                disabled={!canProceed()}
                onClick={handleCheckout}
                type="button"
              >
                Review & Renew
              </button>
            </div>
          </div>
        </Show>

        <Show when={supportsBatch() === true}>
          <div class="mt-4 rounded-card border border-green-primary/20 bg-green-primary/5 p-3">
            <p class="text-xs text-green-primary">
              Your wallet supports batch transactions. Multiple renewals can be sent in one call.
            </p>
          </div>
        </Show>
      </div>

      <TransactionModal
        isOpen={showModal()}
        onClose={handleClose}
        onConfirm={() => void handleConfirm()}
        state={transaction.state()}
        title="Renew Names"
      />
    </>
  );
};
