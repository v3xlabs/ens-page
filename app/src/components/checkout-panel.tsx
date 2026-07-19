import { useNavigate } from "@tanstack/solid-router";
import { useClient } from "@wagmi/solid";
import { TbOutlinePlus, TbOutlineX } from "solid-icons/tb";
import { createMemo, createSignal, For, Show } from "solid-js";
import { formatEther } from "viem/utils";

import { useActivityLog } from "../hooks/useActivityLog";
import { PRICE_PER_YEAR_USD, type PriceTier, useCart } from "../hooks/useCart";
import { usePools } from "../hooks/usePools";
import { useTierRenewalQuotes } from "../hooks/useRenewalQuote";
import { useTransaction } from "../hooks/useTransaction";
import { formatYears, t } from "../i18n";
import { normalizeName } from "../utils/ens";
import { fetchRenewalQuote, groupNamesByTier, prepareRenewAll, SECONDS_PER_YEAR } from "../utils/renewal";
import { TransactionModal, type TransactionSummaryRow } from "./transaction-modal";

const TIER_ORDER: readonly PriceTier[] = ["3char", "4char", "standard"];

const TIER_LABELS: Record<PriceTier, string> = {
  "3char": "3-char",
  "4char": "4-char",
  "standard": "standard (5+ chars)",
};

const formatEth = (wei: bigint) => `${Number(formatEther(wei)).toFixed(5)} ETH`;

const pluralize = (count: number) => (count === 1 ? "" : "s");

// Names added through the panel's add-input rather than the owned-names list;
// the cart itself persists, this flag only drives the "not yours" annotations.
const [externalNames, setExternalNames] = createSignal<ReadonlySet<string>>(new Set<string>());

const clearExternal = () => setExternalNames(new Set<string>());

export const CheckoutPanel = () => {
  const { addItem, cartCount, cartItems, clearCart, removeItem } = useCart();
  const { setPoolSeed } = usePools();
  const { recordActivity, updateActivity } = useActivityLog();
  const navigate = useNavigate();
  const transaction = useTransaction();
  const client = useClient();

  const [durationYears, setDurationYears] = createSignal(1);
  const [addNameValue, setAddNameValue] = createSignal("");
  const [isAddOpen, setIsAddOpen] = createSignal(false);
  const [showModal, setShowModal] = createSignal(false);

  const durationSeconds = createMemo(() => durationYears() * SECONDS_PER_YEAR);

  const tierGroups = createMemo(() => groupNamesByTier(cartItems(), TIER_ORDER));

  const namesByTier = createMemo((): Record<PriceTier, string[]> => {
    const byTier: Record<PriceTier, string[]> = { "3char": [], "4char": [], "standard": [] };

    for (const item of cartItems()) byTier[item.tier].push(item.name);

    return byTier;
  });

  const quotes = useTierRenewalQuotes(namesByTier, durationSeconds);

  const quoteFor = (tier: PriceTier) => quotes[tier].data;

  const isQuotesReady = createMemo(() => tierGroups().every(group => quoteFor(group.tier) !== undefined));

  const totalWei = createMemo(() => tierGroups().reduce(
    (sum, group) => sum + (quoteFor(group.tier)?.totalWei ?? 0n),
    0n,
  ));

  const externalCount = createMemo(() => cartItems().filter(item => externalNames().has(item.name)).length);

  const headerText = createMemo(() => {
    const nameCount = cartCount();
    const tierCount = tierGroups().length;

    return `${nameCount} name${pluralize(nameCount)} selected · ${tierCount} price tier${pluralize(tierCount)} → ${tierCount} transaction${pluralize(tierCount)}`;
  });

  // Captured when review opens so the title and summary survive the
  // post-success clearCart.
  const [modalTitle, setModalTitle] = createSignal("");
  const [reviewSummary, setReviewSummary] = createSignal<TransactionSummaryRow[]>([]);

  const handleAddName = () => {
    const raw = addNameValue().trim();

    if (!raw) return;

    const normalized = normalizeName(raw.includes(".") ? raw : `${raw}.eth`);

    if (!normalized) return;

    addItem(normalized, 0);
    setExternalNames(previous => new Set(previous).add(normalized));
    setAddNameValue("");
  };

  const handlePoolSelection = () => {
    setPoolSeed(cartItems().map(item => item.name));
    void navigate({ to: "/pools/new" });
  };

  const handleClear = () => {
    clearCart();
    clearExternal();
    setIsAddOpen(false);
  };

  const handleRemoveGroup = (names: string[]) => {
    for (const name of names) removeItem(name);
  };

  const handleReview = () => {
    if (cartCount() === 0 || !isQuotesReady()) return;

    setModalTitle(`Renew ${cartCount()} name${pluralize(cartCount())} · ${durationYears()}y`);
    setReviewSummary([
      { label: "Action", value: `Renew ${cartCount()} name${pluralize(cartCount())}` },
      { label: "Duration", value: `${durationYears()} year${pluralize(durationYears())}` },
      { label: "Transactions", value: String(tierGroups().length) },
      { label: "Total cost", value: formatEth(totalWei()) },
    ]);
    transaction.preview();
    setShowModal(true);
  };

  const handleClose = () => {
    setShowModal(false);
    transaction.reset();
  };

  const handleConfirm = async () => {
    const groups = tierGroups();
    const duration = durationSeconds();
    const publicClient = client();

    if (groups.length === 0 || !publicClient) return;

    const nameCount = groups.reduce((sum, group) => sum + group.names.length, 0);
    const activityId = recordActivity({
      detail: groups.flatMap(group => group.names).join(", "),
      kind: "renewal",
      status: "in-progress",
      steps: groups.map((group, index) => ({
        key: group.tier,
        label: `Transaction ${index + 1} · $${PRICE_PER_YEAR_USD[group.tier]}/yr tier`,
        status: index === 0 ? "active" : "pending",
      })),
      title: `Renew ${nameCount} name${pluralize(nameCount)} · ${durationYears()}y`,
      txHashes: [],
    });

    // Re-quote right before each transaction so an oracle price update between
    // review and confirmation cannot make a renewal underpay and revert.
    const hashes = await transaction.sendSequence(
      groups.map(group => async () => {
        const freshQuote = await fetchRenewalQuote(publicClient, group.names, duration);

        return prepareRenewAll(group.names, duration, freshQuote.pricePerNameWei);
      }),
      {
        onTransactionConfirmed: index => updateActivity(activityId, entry => ({
          ...entry,
          steps: entry.steps.map((step, stepIndex) => {
            if (stepIndex === index) return { ...step, status: "done" };

            if (stepIndex === index + 1) return { ...step, status: "active" };

            return step;
          }),
        })),
        onTransactionSent: hash => updateActivity(activityId, entry => ({
          ...entry,
          txHashes: [...entry.txHashes, hash],
        })),
      },
    );

    if (hashes) {
      updateActivity(activityId, entry => ({ ...entry, status: "success" }));
      clearCart();
      clearExternal();

      return;
    }

    const failedState = transaction.state();
    const errorMessage = failedState.step === "error" ? failedState.error : "Transaction failed";

    updateActivity(activityId, entry => ({
      ...entry,
      status: "failed",
      steps: entry.steps.map(step => (step.status === "active"
        ? { ...step, detail: errorMessage, status: "failed" }
        : step)),
    }));
  };

  return (
    <>
      <Show when={cartCount() > 0}>
        <div
          class="card fixed bottom-4 left-1/2 z-30 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 border border-border p-4 shadow-2xl sm:p-5"
          data-testid="checkout-panel"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <strong class="text-sm tabular-nums">{headerText()}</strong>
            <button
              class="cursor-pointer text-sm font-bold text-text-secondary transition-colors hover:text-text-primary"
              data-testid="cart-clear"
              onClick={handleClear}
              type="button"
            >
              Clear
            </button>
          </div>

          <div class="mt-3 space-y-1.5 border-t border-border pt-3" data-testid="checkout-breakdown">
            <For each={tierGroups()}>
              {group => (
                <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span class="flex items-center gap-2">
                    {group.names.length}
                    {" × "}
                    {TIER_LABELS[group.tier]}
                    <span class="tag grey tabular-nums">
                      $
                      {PRICE_PER_YEAR_USD[group.tier]}
                      /yr
                    </span>
                  </span>
                  <span class="flex items-center gap-2 tabular-nums text-text-secondary">
                    <Show when={quoteFor(group.tier)} fallback="…">
                      {quote => (
                        <>
                          {group.names.length}
                          {" × "}
                          {formatEth(quote().pricePerNameWei)}
                          {" = "}
                          <b class="text-text-primary">{formatEth(quote().totalWei)}</b>
                        </>
                      )}
                    </Show>
                    <button
                      class="icon-button small"
                      onClick={() => handleRemoveGroup(group.names)}
                      title={`Remove ${group.names.length} ${TIER_LABELS[group.tier]} name${pluralize(group.names.length)}`}
                      type="button"
                    >
                      <TbOutlineX size={12} />
                    </button>
                  </span>
                </div>
              )}
            </For>
            <Show when={externalCount() > 0}>
              <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span class="text-text-secondary">
                  includes
                  {" "}
                  <b>{externalCount()}</b>
                  {" "}
                  {`name${pluralize(externalCount())} you don't own — renewals are permissionless`}
                </span>
                <span class="tag blue tabular-nums">
                  {externalCount()}
                  {" "}
                  not yours
                </span>
              </div>
            </Show>
          </div>

          <Show when={isAddOpen()}>
            <div class="mt-3 flex items-center gap-2">
              <input
                class="input flex-1"
                data-testid="checkout-add-name"
                onInput={event => setAddNameValue(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleAddName();

                  if (event.key === "Escape") setIsAddOpen(false);
                }}
                placeholder={t("checkout.addAnyName")}
                ref={element => setTimeout(() => element.focus())}
                type="text"
                value={addNameValue()}
              />
              <button class="button subtle" onClick={handleAddName} type="button">
                {t("common.add")}
              </button>
            </div>
          </Show>

          <div class="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <select
              aria-label={t("checkout.renewalDuration")}
              class="cursor-pointer rounded-button border border-border bg-background-secondary px-3 py-2 font-bold tabular-nums"
              data-testid="cart-duration"
              onChange={event => setDurationYears(Number(event.currentTarget.value))}
              value={durationYears()}
            >
              <option value={1}>{formatYears(1)}</option>
              <option value={2}>{formatYears(2)}</option>
              <option value={3}>{formatYears(3)}</option>
              <option value={5}>{formatYears(5)}</option>
            </select>
            <button
              aria-expanded={isAddOpen()}
              aria-label={t("checkout.addName")}
              class="icon-button size-10"
              onClick={() => setIsAddOpen(previous => !previous)}
              title={t("checkout.addAnyName")}
              type="button"
            >
              <TbOutlinePlus size={18} />
            </button>
            <div class="ml-auto text-right">
              <span class="block text-[0.65rem] font-bold uppercase text-text-secondary">
                Total · controller rate
              </span>
              <span class="block text-lg font-bold leading-tight tabular-nums" data-testid="cart-total">
                <Show when={isQuotesReady()} fallback="…">
                  {formatEth(totalWei())}
                </Show>
              </span>
            </div>
            <button
              aria-label={t("checkout.createPool")}
              class="button subtle"
              data-testid="checkout-pool-from-selection"
              onClick={handlePoolSelection}
              title={t("checkout.createPool")}
              type="button"
            >
              ⬡ Pool
            </button>
            <button
              class="button primary"
              data-testid="cart-review"
              disabled={!isQuotesReady()}
              onClick={handleReview}
              type="button"
            >
              Review & Renew
            </button>
          </div>
        </div>
      </Show>

      <TransactionModal
        isOpen={showModal()}
        onClose={handleClose}
        onConfirm={() => void handleConfirm()}
        state={transaction.state()}
        summary={reviewSummary()}
        title={modalTitle()}
      >
        <div class="mt-4 space-y-3">
          <For each={tierGroups()}>
            {(group, index) => (
              <div class="rounded-card border border-border p-3">
                <div class="flex items-center justify-between gap-2 text-sm font-bold">
                  <span>
                    Transaction
                    {" "}
                    {index() + 1}
                    {" · $"}
                    {PRICE_PER_YEAR_USD[group.tier]}
                    /yr tier
                  </span>
                  <span class="tabular-nums">
                    <Show when={quoteFor(group.tier)} fallback="…">
                      {quote => formatEth(quote().totalWei)}
                    </Show>
                  </span>
                </div>
                <For each={group.names}>
                  {name => (
                    <div class="mt-1 flex items-center justify-between gap-2 text-sm text-text-secondary">
                      <span class="truncate">
                        {name}
                        {externalNames().has(name) ? " · not yours" : ""}
                      </span>
                      <span class="tabular-nums">
                        <Show when={quoteFor(group.tier)} fallback="…">
                          {quote => formatEth(quote().pricePerNameWei)}
                        </Show>
                      </span>
                    </div>
                  )}
                </For>
              </div>
            )}
          </For>
        </div>
      </TransactionModal>
    </>
  );
};
