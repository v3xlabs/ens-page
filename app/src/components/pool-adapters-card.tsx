import { useQueryClient } from "@tanstack/solid-query";
import { useChainId, useClient } from "@wagmi/solid";
import { useQuery } from "@wagmi/solid/query";
import { type Accessor, createMemo, createSignal, For, Show } from "solid-js";
import type { Address } from "viem";
import { parseEther } from "viem";
import { readContract } from "viem/actions";

import { erc20Abi } from "../contracts/adapters";
import {
  type AdapterKind,
  decodeSwapStepData,
  encodeSwapStepData,
  prepareConfigureAdapters,
  prepareExecuteRoute,
  type RouteStep,
  usePoolAdapters,
  useTokenRoutes,
} from "../hooks/usePoolAdapters";
import { useTrackedTokens } from "../hooks/useTrackedTokens";
import { type TransactionRequest, useTransaction } from "../hooks/useTransaction";
import { formatTokenAmount, type TrackedToken } from "../utils/tokens";
import { PoolTokenTracker } from "./pool-token-tracker";
import { TransactionModal, type TransactionSummaryRow } from "./transaction-modal";

const ADAPTER_LABELS: Record<AdapterKind, { description: string; name: string; }> = {
  stream: { description: "Accept ETH and token streams that vest into the pool over time.", name: "Streams" },
  swap: { description: "Convert deposited tokens to ETH through Uniswap before renewals.", name: "Swap · Uniswap" },
  unknown: { description: "Unrecognized adapter.", name: "Unknown adapter" },
  yield: { description: "Redeem ERC4626 vault shares into their underlying asset.", name: "Yield · ERC4626" },
};

const FEE_TIERS = [
  { label: "0.05%", value: 500 },
  { label: "0.3%", value: 3000 },
  { label: "1%", value: 10_000 },
] as const;

// Tolerance against the ETH/USD oracle for stable swaps: the registrar prices
// renewals in USD, so a $1-stable deposit must fetch oracle-fair ETH.
const DEFAULT_ORACLE_BPS = 150;

type RouteKind = "none" | "swap" | "yield-swap";

type RouteDraft = {
  feeTier: number;
  floor: string;
  kind: RouteKind;
  oracleGuard: boolean;
};

type PoolAdaptersCardProperties = {
  isOwner: boolean;
  onEthChanged: () => void;
  poolAddress: Accessor<Address | undefined>;
};

export const PoolAdaptersCard = (properties: PoolAdaptersCardProperties) => {
  const queryClient = useQueryClient();
  const chainId = useChainId();
  const client = useClient(() => ({ chainId: chainId() }));
  const transaction = useTransaction();
  const adapters = usePoolAdapters(properties.poolAddress);
  const { customTokens, removeToken, trackedTokens } = useTrackedTokens();
  const trackedTokenAddresses = createMemo(() => trackedTokens().map(token => token.address));
  const routes = useTokenRoutes(properties.poolAddress, trackedTokenAddresses);

  const balances = useQuery<Record<string, bigint>, Error, Record<string, bigint>, readonly ["poolTokenBalances", number, Address | undefined, string]>(() => ({
    enabled: properties.poolAddress() !== undefined,
    queryFn: async () => {
      const publicClient = client();
      const pool = properties.poolAddress();

      if (!publicClient || !pool) return {};

      const entries = await Promise.all(trackedTokens().map(async (token): Promise<[string, bigint]> => [
        token.address.toLowerCase(),
        await readContract(publicClient, { abi: erc20Abi, address: token.address, args: [pool], functionName: "balanceOf" }),
      ]));

      return Object.fromEntries(entries);
    },
    queryKey: ["poolTokenBalances", chainId(), properties.poolAddress(), trackedTokenAddresses().join(",")] as const,
  }));

  const [isEditing, setIsEditing] = createSignal(false);
  const [adapterDraft, setAdapterDraft] = createSignal<Record<string, boolean>>({});
  const [routeDrafts, setRouteDrafts] = createSignal<Record<string, RouteDraft>>({});
  const [isReviewOpen, setIsReviewOpen] = createSignal(false);
  const [reviewTitle, setReviewTitle] = createSignal("");
  const [reviewSummary, setReviewSummary] = createSignal<TransactionSummaryRow[]>([]);
  const [reviewRequest, setReviewRequest] = createSignal<TransactionRequest>();

  const adapterByKind = (kind: AdapterKind) => adapters.data?.find(adapter => adapter.kind === kind);

  const routeFor = (token: TrackedToken): RouteStep[] => routes.data?.[token.address.toLowerCase()] ?? [];

  const balanceFor = (token: TrackedToken): bigint => balances.data?.[token.address.toLowerCase()] ?? 0n;

  const adapterKindFor = (address: Address): AdapterKind =>
    adapters.data?.find(adapter => adapter.address.toLowerCase() === address.toLowerCase())?.kind ?? "unknown";

  const routeDescription = (token: TrackedToken): string | undefined => {
    const steps = routeFor(token);

    if (steps.length === 0) return;

    const swapStep = steps.find(step => adapterKindFor(step.adapter) === "swap");
    const config = swapStep ? decodeSwapStepData(swapStep.data) : undefined;
    const tier = FEE_TIERS.find(candidate => candidate.value === config?.feeTier);
    const hasYield = steps.some(step => adapterKindFor(step.adapter) === "yield");
    const guard = config && config.oracleSlippageBps > 0 ? " · oracle-guarded" : "";

    return `${token.symbol} → ${hasYield ? "Redeem → " : ""}Swap${tier ? ` ${tier.label}` : ""} → ETH${guard}`;
  };

  const draftFor = (token: TrackedToken): RouteDraft => routeDrafts()[token.address.toLowerCase()] ?? {
    feeTier: 500,
    floor: "",
    kind: "none",
    oracleGuard: true,
  };

  const updateDraft = (token: TrackedToken, update: Partial<RouteDraft>) => {
    setRouteDrafts(previous => ({
      ...previous,
      [token.address.toLowerCase()]: { ...draftFor(token), ...update },
    }));
  };

  const isDraftEnabled = (kind: AdapterKind): boolean => {
    const adapter = adapterByKind(kind);

    if (!adapter) return false;

    return adapterDraft()[adapter.address.toLowerCase()] ?? adapter.isEnabled;
  };

  const startEditing = () => {
    setAdapterDraft(Object.fromEntries(
      (adapters.data ?? []).map(adapter => [adapter.address.toLowerCase(), adapter.isEnabled]),
    ));
    setRouteDrafts(Object.fromEntries(trackedTokens().map((token) => {
      const steps = routeFor(token);
      const swapStep = steps.find(step => adapterKindFor(step.adapter) === "swap");
      const config = swapStep ? decodeSwapStepData(swapStep.data) : undefined;
      const hasYield = steps.some(step => adapterKindFor(step.adapter) === "yield");

      const draft: RouteDraft = {
        feeTier: config?.feeTier ?? 500,
        floor: config && config.minOutPerWad > 0n ? String(Number(config.minOutPerWad) / 1e18) : "",
        kind: steps.length === 0 ? "none" : (hasYield ? "yield-swap" : "swap"),
        oracleGuard: config ? config.oracleSlippageBps > 0 : true,
      };

      return [token.address.toLowerCase(), draft];
    })));
    setIsEditing(true);
  };

  const draftProblem = createMemo(() => {
    const needsSwap = trackedTokens().some(token => draftFor(token).kind !== "none");
    const needsYield = trackedTokens().some(token => draftFor(token).kind === "yield-swap");

    if (needsSwap && !isDraftEnabled("swap")) return "Routes need the swap adapter enabled.";

    if (needsYield && !isDraftEnabled("yield")) return "Redeem routes need the yield adapter enabled.";

    return;
  });

  const buildDraftSteps = (token: TrackedToken): RouteStep[] => {
    const draft = draftFor(token);
    const swap = adapterByKind("swap");
    const yieldAdapter = adapterByKind("yield");

    if (draft.kind === "none" || !swap) return [];

    const floorValue = Number(draft.floor);
    const minOutPerWad = Number.isFinite(floorValue) && floorValue > 0 ? parseEther(draft.floor) : 0n;

    return [
      ...(draft.kind === "yield-swap" && yieldAdapter ? [{ adapter: yieldAdapter.address, data: "0x" as const }] : []),
      {
        adapter: swap.address,
        data: encodeSwapStepData({
          feeTier: draft.feeTier,
          minOutPerWad,
          oracleSlippageBps: draft.oracleGuard ? DEFAULT_ORACLE_BPS : 0,
        }),
      },
    ];
  };

  const reviewDraft = () => {
    const pool = properties.poolAddress();

    if (!pool || draftProblem()) return;

    const settings = (adapters.data ?? []).map(adapter => ({
      adapter: adapter.address,
      enabled: adapterDraft()[adapter.address.toLowerCase()] ?? adapter.isEnabled,
    }));
    const routeUpdates = trackedTokens().map(token => ({ steps: buildDraftSteps(token), token: token.address }));

    const summary: TransactionSummaryRow[] = [
      { label: "Action", value: "Update adapters & routes" },
      ...(adapters.data ?? []).map(adapter => ({
        label: ADAPTER_LABELS[adapter.kind].name,
        value: (adapterDraft()[adapter.address.toLowerCase()] ?? adapter.isEnabled) ? "Enabled" : "Off",
      })),
      ...trackedTokens().map((token) => {
        const draft = draftFor(token);

        return {
          label: `${token.symbol} route`,
          value: draft.kind === "none"
            ? "none"
            : `${draft.kind === "yield-swap" ? "Redeem → " : ""}Swap ${FEE_TIERS.find(tier => tier.value === draft.feeTier)?.label ?? ""} → ETH${draft.oracleGuard ? " · oracle-guarded" : ""}`,
        };
      }),
    ];

    setReviewTitle("Update adapters");
    setReviewSummary(summary);
    setReviewRequest(prepareConfigureAdapters(pool, settings, routeUpdates));
    transaction.preview();
    setIsReviewOpen(true);
  };

  const convertBalance = (token: TrackedToken) => {
    const pool = properties.poolAddress();
    const balance = balanceFor(token);

    if (!pool || balance === 0n) return;

    setReviewTitle("Convert to ETH");
    setReviewSummary([
      { label: "Action", value: `Convert pool ${token.symbol} to ETH` },
      { label: "Amount", value: `${formatTokenAmount(balance, token.decimals)} ${token.symbol}` },
    ]);
    setReviewRequest(prepareExecuteRoute(pool, token.address, balance));
    transaction.preview();
    setIsReviewOpen(true);
  };

  const confirmReview = async () => {
    const request = reviewRequest();

    if (!request) return;

    const hash = await transaction.send(request);

    if (!hash) return;

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["poolAdapters"] }),
      queryClient.invalidateQueries({ queryKey: ["tokenRoutes"] }),
      queryClient.invalidateQueries({ queryKey: ["poolTokenBalances"] }),
    ]);
    setIsEditing(false);
    properties.onEthChanged();
  };

  const closeReview = () => {
    setIsReviewOpen(false);
    transaction.reset();
  };

  return (
    <div class="mt-5 border-t border-border pt-4" data-testid="pool-adapters">
      <div class="flex items-center justify-between gap-3">
        <h4 class="font-bold">Adapters</h4>
        <Show when={properties.isOwner && !isEditing()}>
          <button class="icon-button small px-2 text-xs font-bold" data-testid="adapters-edit" onClick={startEditing} type="button">
            Edit
          </button>
        </Show>
      </div>

      <Show
        when={(adapters.data?.length ?? 0) > 0}
        fallback={<p class="mt-2 text-sm text-text-secondary">No adapters are registered on the factory.</p>}
      >
        <div class="mt-1">
          <For each={adapters.data ?? []}>
            {adapter => (
              <div class="flex items-center gap-3 border-b border-border py-2.5 last:border-b-0">
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-bold">{ADAPTER_LABELS[adapter.kind].name}</p>
                  <p class="text-xs text-text-secondary">{ADAPTER_LABELS[adapter.kind].description}</p>
                </div>
                <Show
                  when={isEditing()}
                  fallback={(
                    <span
                      classList={{
                        "text-green-primary": adapter.isEnabled,
                        "text-text-secondary": !adapter.isEnabled,
                        "text-xs font-bold": true,
                      }}
                    >
                      {adapter.isEnabled ? "● Enabled" : "○ Off"}
                    </span>
                  )}
                >
                  <label class="flex items-center gap-2 text-xs font-bold">
                    <input
                      checked={adapterDraft()[adapter.address.toLowerCase()] ?? adapter.isEnabled}
                      data-testid={`adapter-check-${adapter.kind}`}
                      onChange={event => setAdapterDraft(previous => ({
                        ...previous,
                        [adapter.address.toLowerCase()]: event.currentTarget.checked,
                      }))}
                      type="checkbox"
                    />
                    Enabled
                  </label>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>

      <h5 class="mt-4 text-sm font-bold">Tokens</h5>
      <div class="mt-1">
        <For each={trackedTokens()}>
          {token => (
            <div class="border-b border-border py-2.5 text-sm last:border-b-0">
              <div class="flex flex-wrap items-center gap-2">
                <div class="min-w-0 flex-1">
                  <p class="font-bold">
                    {token.symbol}
                    {" "}
                    <span class="font-normal text-text-secondary tabular-nums">
                      {formatTokenAmount(balanceFor(token), token.decimals)}
                      {" "}
                      in pool
                    </span>
                  </p>
                  <Show when={!isEditing()}>
                    <p class="text-xs text-text-secondary">
                      {routeDescription(token) ?? "No route configured — deposits stay in this token."}
                    </p>
                  </Show>
                </div>
                <Show when={!isEditing() && routeFor(token).length > 0 && balanceFor(token) > 0n}>
                  <button
                    class="button subtle"
                    data-testid={`route-convert-${token.symbol}`}
                    onClick={() => convertBalance(token)}
                    type="button"
                  >
                    Convert to ETH
                  </button>
                </Show>
                <Show when={isEditing() && customTokens().some(custom => custom.address.toLowerCase() === token.address.toLowerCase())}>
                  <button
                    aria-label={`Stop tracking ${token.symbol}`}
                    class="icon-button small px-2 text-xs font-bold"
                    data-testid={`token-remove-${token.symbol}`}
                    onClick={() => removeToken(token.address)}
                    type="button"
                  >
                    Remove
                  </button>
                </Show>
              </div>

              <Show when={isEditing()}>
                <div class="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-text-secondary">
                  <select
                    class="cursor-pointer rounded-button border border-border bg-background-secondary px-2 py-1.5 font-bold"
                    data-testid={`route-kind-${token.symbol}`}
                    onChange={event => updateDraft(token, { kind: event.currentTarget.value === "swap" ? "swap" : (event.currentTarget.value === "yield-swap" ? "yield-swap" : "none") })}
                    value={draftFor(token).kind}
                  >
                    <option value="none">No route</option>
                    <Show
                      when={token.isVault}
                      fallback={<option value="swap">Swap → ETH</option>}
                    >
                      <option value="yield-swap">Redeem → Swap → ETH</option>
                    </Show>
                  </select>
                  <Show when={draftFor(token).kind !== "none"}>
                    <select
                      class="cursor-pointer rounded-button border border-border bg-background-secondary px-2 py-1.5 font-bold tabular-nums"
                      data-testid={`route-fee-${token.symbol}`}
                      onChange={event => updateDraft(token, { feeTier: Number(event.currentTarget.value) })}
                      value={draftFor(token).feeTier}
                    >
                      <For each={[...FEE_TIERS]}>
                        {tier => <option value={tier.value}>{tier.label}</option>}
                      </For>
                    </select>
                    <label class="flex items-center gap-1.5">
                      <input
                        checked={draftFor(token).oracleGuard}
                        data-testid={`route-guard-${token.symbol}`}
                        onChange={event => updateDraft(token, { oracleGuard: event.currentTarget.checked })}
                        type="checkbox"
                      />
                      Oracle guard
                    </label>
                    <input
                      class="w-28 rounded-button border border-border bg-background-secondary px-2 py-1.5 font-bold tabular-nums"
                      data-testid={`route-floor-${token.symbol}`}
                      min="0"
                      onInput={event => updateDraft(token, { floor: event.currentTarget.value })}
                      placeholder="Min ETH/token"
                      step="any"
                      type="number"
                      value={draftFor(token).floor}
                    />
                  </Show>
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>

      <Show when={isEditing()}>
        <PoolTokenTracker />
        <Show when={draftProblem()}>
          {problem => <p class="mt-2 text-xs font-bold text-yellow-active">{problem()}</p>}
        </Show>
        <div class="mt-3 flex justify-end gap-2">
          <button class="button subtle" onClick={() => setIsEditing(false)} type="button">Cancel</button>
          <button
            class="button primary"
            data-testid="adapters-save"
            disabled={draftProblem() !== undefined}
            onClick={reviewDraft}
            type="button"
          >
            Review changes
          </button>
        </div>
      </Show>

      <TransactionModal
        isOpen={isReviewOpen()}
        onClose={closeReview}
        onConfirm={() => void confirmReview()}
        state={transaction.state()}
        summary={reviewSummary()}
        title={reviewTitle()}
      />
    </div>
  );
};
