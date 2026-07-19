import { Dialog } from "@kobalte/core/dialog";
import { useQueryClient } from "@tanstack/solid-query";
import { TbOutlineX } from "solid-icons/tb";
import { type Accessor, createMemo, createSignal, For, Show } from "solid-js";
import type { Address } from "viem";
import { parseEther } from "viem";

import {
  prepareCreateEthStream,
  prepareCreateTokenStream,
  prepareErc20Approve,
  prepareErc20Transfer,
  usePoolAdapters,
  useTokenRoutes,
} from "../hooks/usePoolAdapters";
import { type Pool, usePools } from "../hooks/usePools";
import { useTrackedTokens } from "../hooks/useTrackedTokens";
import { type TransactionRequest, useTransaction } from "../hooks/useTransaction";
import { shortenAddress } from "../utils/ens";
import { parseTokenAmount, tokenLabel } from "../utils/tokens";
import { TransactionModal, type TransactionSummaryRow } from "./transaction-modal";

type PoolFundFlowProperties = {
  onDeposited: () => void;
  pool: Pool;
  poolAddress: Accessor<Address | undefined>;
};

type FundingTab = "stream" | "token";

const STREAM_DURATION_DAYS = [30, 90, 180, 365] as const;

const daySeconds = 86_400n;

export const PoolFundFlow = (properties: PoolFundFlowProperties) => {
  const { depositToPool } = usePools();
  const queryClient = useQueryClient();
  const transaction = useTransaction();
  const adapters = usePoolAdapters(properties.poolAddress);
  const { findTrackedToken, trackedTokens } = useTrackedTokens();
  const trackedTokenAddresses = createMemo(() => trackedTokens().map(token => token.address));
  const routes = useTokenRoutes(properties.poolAddress, trackedTokenAddresses);

  const [isChooseOpen, setIsChooseOpen] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<FundingTab>("token");
  const [selectedToken, setSelectedToken] = createSignal<"eth" | Address>("eth");
  const [amountInput, setAmountInput] = createSignal("");
  const [durationDays, setDurationDays] = createSignal(30);
  const [isReviewOpen, setIsReviewOpen] = createSignal(false);
  const [reviewTitle, setReviewTitle] = createSignal("");
  const [reviewSummary, setReviewSummary] = createSignal<TransactionSummaryRow[]>([]);
  const [reviewRequests, setReviewRequests] = createSignal<TransactionRequest[]>([]);
  const [reviewEthAmount, setReviewEthAmount] = createSignal<number>();
  const [reviewMethod, setReviewMethod] = createSignal<"direct" | "stream">("direct");

  const streamAdapter = createMemo(() => adapters.data?.find(adapter => adapter.kind === "stream"));
  const isStreamReady = createMemo(() => streamAdapter()?.isEnabled === true);

  const routeStepsFor = (token: Address) => routes.data?.[token.toLowerCase()] ?? [];

  const poolDisplay = () => {
    const address = properties.poolAddress();

    return address ? shortenAddress(address) : properties.pool.label;
  };

  const openChoice = () => {
    setAmountInput("");
    setSelectedToken("eth");
    setActiveTab("token");
    setIsChooseOpen(true);
  };

  const parsedAmount = createMemo(() => {
    const selection = selectedToken();

    if (selection === "eth") {
      const value = Number(amountInput());

      return Number.isFinite(value) && value > 0 ? parseEther(amountInput()) : undefined;
    }

    const token = findTrackedToken(selection);

    return token ? parseTokenAmount(amountInput(), token.decimals) : undefined;
  });

  const amountLabel = () => {
    const selection = selectedToken();

    if (selection === "eth") return `${amountInput()} ETH`;

    return `${amountInput()} ${findTrackedToken(selection)?.symbol ?? tokenLabel(selection)}`;
  };

  const canReview = createMemo(() => {
    if (parsedAmount() === undefined) return false;

    if (activeTab() === "stream") return isStreamReady();

    return true;
  });

  const openReview = () => {
    const pool = properties.poolAddress();
    const amount = parsedAmount();
    const selection = selectedToken();

    if (!pool || amount === undefined) return;

    if (activeTab() === "token") {
      if (selection === "eth") {
        setReviewRequests([{ data: "0x", to: pool, value: amount }]);
        setReviewEthAmount(Number(amountInput()));
      }
      else {
        setReviewRequests([prepareErc20Transfer(selection, pool, amount)]);
        setReviewEthAmount();
      }

      setReviewMethod("direct");
      setReviewTitle("Fund pool");
      setReviewSummary([
        { label: "Action", value: "Deposit into pool" },
        { label: "Pool", value: poolDisplay() },
        { label: "Amount", value: amountLabel() },
        ...(selection !== "eth" && routeStepsFor(selection).length === 0
          ? [{ label: "Note", value: "No conversion route configured yet" }]
          : []),
      ]);
    }
    else {
      const adapter = streamAdapter();

      if (!adapter) return;

      const durationSeconds = BigInt(durationDays()) * daySeconds;

      if (selection === "eth") {
        setReviewRequests([prepareCreateEthStream(adapter.address, pool, durationSeconds, amount)]);
        setReviewEthAmount(Number(amountInput()));
      }
      else {
        setReviewRequests([
          prepareErc20Approve(selection, adapter.address, amount),
          prepareCreateTokenStream(adapter.address, pool, selection, amount, durationSeconds),
        ]);
        setReviewEthAmount();
      }

      setReviewMethod("stream");
      setReviewTitle("Start stream");
      setReviewSummary([
        { label: "Action", value: "Stream into pool" },
        { label: "Pool", value: poolDisplay() },
        { label: "Total", value: amountLabel() },
        { label: "Duration", value: `${durationDays()} days` },
      ]);
    }

    transaction.preview();
    setIsChooseOpen(false);
    setIsReviewOpen(true);
  };

  const confirmReview = async () => {
    const hashes = await transaction.sendSequence(reviewRequests().map(request => () => Promise.resolve(request)));

    if (!hashes) return;

    const ethAmount = reviewEthAmount();

    if (ethAmount !== undefined) depositToPool(properties.pool.poolId, ethAmount, reviewMethod());

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["poolStreams"] }),
      queryClient.invalidateQueries({ queryKey: ["poolTokenBalances"] }),
    ]);
    properties.onDeposited();
  };

  const closeReview = () => {
    setIsReviewOpen(false);
    transaction.reset();
  };

  const TabButton = (tabProperties: { label: string; tab: FundingTab; }) => (
    <button
      aria-pressed={activeTab() === tabProperties.tab}
      classList={{
        "bg-blue-surface text-blue-primary": activeTab() === tabProperties.tab,
        "flex-1 cursor-pointer rounded-button px-3 py-2 text-sm font-bold transition-colors": true,
        "text-text-secondary hover:text-text-primary": activeTab() !== tabProperties.tab,
      }}
      data-testid={`fund-tab-${tabProperties.tab}`}
      onClick={() => setActiveTab(tabProperties.tab)}
      type="button"
    >
      {tabProperties.label}
    </button>
  );

  return (
    <>
      <button class="button primary" data-testid="pool-fund" onClick={openChoice} type="button">Fund pool</button>

      <Dialog open={isChooseOpen()} onOpenChange={setIsChooseOpen}>
        <Dialog.Portal>
          <Dialog.Overlay class="dialog-overlay" />
          <div class="dialog-positioner">
            <Dialog.Content class="dialog-content" data-testid="fund-choice">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <Dialog.Title class="text-xl font-bold">Fund pool</Dialog.Title>
                  <Dialog.Description class="mt-1 text-sm text-text-secondary">
                    Deposit once, or stream steadily over time.
                  </Dialog.Description>
                </div>
                <Dialog.CloseButton aria-label="Close funding dialog" class="icon-button small" type="button">
                  <TbOutlineX size={16} />
                </Dialog.CloseButton>
              </div>

              <div class="mt-4 flex gap-1 rounded-button bg-background-secondary p-1">
                <TabButton label="Token" tab="token" />
                <TabButton label="Stream" tab="stream" />
              </div>

              <div class="mt-4 space-y-4">
                <label class="grid gap-1 text-sm font-bold text-text-secondary">
                  Token
                  <select
                    class="input cursor-pointer"
                    data-testid="fund-token-select"
                    onChange={event => setSelectedToken(event.currentTarget.value === "eth" ? "eth" : (event.currentTarget.value as Address))}
                    value={selectedToken()}
                  >
                    <option value="eth">ETH</option>
                    <For each={trackedTokens()}>
                      {token => <option value={token.address}>{token.symbol}</option>}
                    </For>
                  </select>
                </label>

                <Show when={selectedToken() !== "eth" && activeTab() === "token"}>
                  <p class="text-sm text-text-secondary">
                    <Show
                      when={selectedToken() !== "eth" && routeStepsFor(selectedToken() as Address).length > 0}
                      fallback="No conversion route is configured for this token yet — deposits stay in the token until the owner adds one under Adapters."
                    >
                      A conversion route is configured — anyone can convert this deposit to ETH before renewals.
                    </Show>
                  </p>
                </Show>

                <label class="grid gap-1 text-sm font-bold text-text-secondary">
                  Amount
                  <input
                    class="input tabular-nums"
                    data-testid="fund-amount"
                    min="0"
                    onInput={event => setAmountInput(event.currentTarget.value)}
                    placeholder="0.00"
                    step="any"
                    type="number"
                    value={amountInput()}
                  />
                </label>

                <Show when={activeTab() === "stream"}>
                  <label class="grid gap-1 text-sm font-bold text-text-secondary">
                    Duration
                    <select
                      class="input cursor-pointer tabular-nums"
                      data-testid="fund-duration"
                      onChange={event => setDurationDays(Number(event.currentTarget.value))}
                      value={durationDays()}
                    >
                      <For each={[...STREAM_DURATION_DAYS]}>
                        {days => (
                          <option value={days}>
                            {days}
                            {" "}
                            days
                          </option>
                        )}
                      </For>
                    </select>
                  </label>

                  <Show when={!isStreamReady()}>
                    <p class="text-sm text-yellow-active">
                      The pool owner has not enabled the stream adapter yet, so streams cannot be opened.
                    </p>
                  </Show>
                </Show>

                <div class="flex justify-end">
                  <button
                    class="button primary"
                    data-testid="fund-review"
                    disabled={!canReview()}
                    onClick={openReview}
                    type="button"
                  >
                    {activeTab() === "token" ? "Review deposit" : "Review stream"}
                  </button>
                </div>
              </div>
            </Dialog.Content>
          </div>
        </Dialog.Portal>
      </Dialog>

      <TransactionModal
        isOpen={isReviewOpen()}
        onClose={closeReview}
        onConfirm={() => void confirmReview()}
        state={transaction.state()}
        summary={reviewSummary()}
        title={reviewTitle()}
      />
    </>
  );
};
