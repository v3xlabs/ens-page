import { TbOutlineCheck, TbOutlinePencil } from "solid-icons/tb";
import { createMemo, createSignal, For, Show } from "solid-js";

import { type Pool, type PoolDeposit, usePools } from "../hooks/usePools";
import { t } from "../i18n";
import { formatEth } from "./pool-card";
import { depositMethodStyle, formatDepositDate } from "./pool-format";

export const RENEWAL_WINDOW_STOPS_DAYS = [10, 20, 30, 60, 90, 180, 365] as const;

const nearestStopIndex = (days: number) => {
  let bestIndex = 0;

  for (const [index, stop] of RENEWAL_WINDOW_STOPS_DAYS.entries()) {
    if (Math.abs(stop - days) < Math.abs(RENEWAL_WINDOW_STOPS_DAYS[bestIndex] - days)) bestIndex = index;
  }

  return bestIndex;
};

export const RenewalWindowSlider = (properties: { onChange: (days: number) => void; valueDays: number; }) => {
  const stopIndex = createMemo(() => nearestStopIndex(properties.valueDays));

  return (
    <label class="grid gap-1 text-sm font-bold text-text-secondary">
      <span class="flex items-baseline justify-between gap-3">
        Renewal window
        <span class="tabular-nums text-text-primary">
          {RENEWAL_WINDOW_STOPS_DAYS[stopIndex()]}
          {" "}
          days before expiry
        </span>
      </span>
      <input
        class="w-full accent-blue-primary"
        data-testid="pool-config-window"
        max={RENEWAL_WINDOW_STOPS_DAYS.length - 1}
        min="0"
        onInput={event => properties.onChange(RENEWAL_WINDOW_STOPS_DAYS[Number(event.currentTarget.value)] ?? 30)}
        step="1"
        type="range"
        value={stopIndex()}
      />
      <span class="flex justify-between text-[0.65rem] font-bold text-text-secondary">
        <For each={[...RENEWAL_WINDOW_STOPS_DAYS]}>
          {stop => <span class="tabular-nums">{stop}</span>}
        </For>
      </span>
    </label>
  );
};

// The label is a private local note, so renaming writes straight to the
// pool store — no transaction involved.
export const PoolLabelEditor = (properties: { label: string; poolId: string; }) => {
  const { renamePool } = usePools();
  const [isEditing, setIsEditing] = createSignal(false);
  const [draft, setDraft] = createSignal("");

  const startEditing = () => {
    setDraft(properties.label);
    setIsEditing(true);
  };

  const save = () => {
    const value = draft().trim();

    if (value && value !== properties.label) renamePool(properties.poolId, value);

    setIsEditing(false);
  };

  return (
    <Show
      when={isEditing()}
      fallback={(
        <>
          <h2 class="text-xl font-bold tracking-tight text-text-secondary">{properties.label}</h2>
          <button
            aria-label={t("pools.renameNote")}
            class="icon-button small"
            data-testid="pool-label-edit"
            onClick={startEditing}
            type="button"
          >
            <TbOutlinePencil size={13} />
          </button>
        </>
      )}
    >
      <input
        aria-label={t("pools.note")}
        class="input h-10 min-h-0 max-w-56"
        data-testid="pool-label-input"
        onInput={event => setDraft(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") save();

          if (event.key === "Escape") setIsEditing(false);
        }}
        value={draft()}
      />
      <button
        aria-label={t("pools.saveNote")}
        class="icon-button small"
        data-testid="pool-label-save"
        onClick={save}
        type="button"
      >
        <TbOutlineCheck size={14} />
      </button>
    </Show>
  );
};

export const PoolFundingHistoryCard = (properties: { deposits: PoolDeposit[]; }) => (
  <section class="card p-5">
    <h3 class="text-lg font-bold">{t("pools.fundingHistory")}</h3>

    <Show
      when={properties.deposits.length > 0}
      fallback={<p class="mt-3 text-sm text-text-secondary">{t("pools.noDeposits")}</p>}
    >
      <div class="mt-2">
        <For each={properties.deposits}>
          {deposit => (
            <div class="flex items-center gap-3 border-b border-border py-2.5 last:border-b-0">
              <span
                aria-hidden="true"
                class={`grid size-8 shrink-0 place-items-center rounded-full ${depositMethodStyle[deposit.method].iconClass}`}
              >
                {depositMethodStyle[deposit.method].iconChar}
              </span>
              <span class="flex-1 text-sm font-bold">{depositMethodStyle[deposit.method].verb}</span>
              <span class="font-bold tabular-nums">{formatEth(deposit.amountEth, 5)}</span>
              <span class="w-14 text-right text-xs text-text-secondary tabular-nums">
                {formatDepositDate(deposit.atMs)}
              </span>
            </div>
          )}
        </For>
      </div>
    </Show>
  </section>
);

const DAY_MS = 24 * 60 * 60 * 1000;

export const InitialsCircle = (properties: { name: string; }) => (
  <span
    aria-hidden="true"
    class="grid size-8 shrink-0 place-items-center rounded-full bg-background-disabled text-[0.625rem] font-bold text-text-secondary"
  >
    {properties.name.slice(0, 2).toUpperCase()}
  </span>
);

type PendingRow = {
  costEth: number;
  daysLeft: number | undefined;
  name: string;
};

export const PoolPendingCard = (properties: {
  costsEth: Record<string, number> | undefined;
  expiries: Record<string, number> | undefined;
  pool: Pool;
}) => {
  const pendingRows = createMemo<PendingRow[]>(() => {
    const rows = properties.pool.members.map((member): PendingRow => {
      const expiry = properties.expiries?.[member.name] ?? 0;

      return {
        costEth: properties.costsEth?.[member.name] ?? 0,
        daysLeft: expiry === 0 ? undefined : Math.ceil((expiry * 1000 - Date.now()) / DAY_MS),
        name: member.name,
      };
    });

    return rows.sort((first, second) => {
      if (first.daysLeft === undefined && second.daysLeft === undefined) return first.name.localeCompare(second.name);

      if (first.daysLeft === undefined) return 1;

      if (second.daysLeft === undefined) return -1;

      return first.daysLeft - second.daysLeft;
    });
  });

  const totalPendingEth = createMemo(() => pendingRows().reduce((sum, row) => sum + row.costEth, 0));

  const coveredCount = createMemo(() => {
    let remainingEth = properties.pool.balanceEth;
    let covered = 0;

    for (const row of pendingRows()) {
      if (row.costEth > remainingEth) break;

      remainingEth -= row.costEth;
      covered += 1;
    }

    return covered;
  });

  const shortfallEth = createMemo(() => Math.max(0, totalPendingEth() - properties.pool.balanceEth));

  const isWindowOpen = (row: PendingRow) =>
    row.daysLeft !== undefined && row.daysLeft <= properties.pool.renewHorizonDays;

  const renewsLabel = (row: PendingRow) => {
    if (row.daysLeft === undefined) return "expiry unknown";

    if (isWindowOpen(row)) return "window open";

    return `renews in ~${Math.max(0, row.daysLeft - properties.pool.renewHorizonDays)}d`;
  };

  return (
    <section class="card p-5" data-testid="pool-pending">

      <h3 class="text-lg font-bold">{t("pools.pending")}</h3>
      <Show
        when={pendingRows().length > 0}
        fallback={<p class="mt-4 text-sm text-text-secondary">{t("pools.noNames")}</p>}
      >
        <p class="mt-1 text-sm text-text-secondary">{t("pools.forecast")}</p>
        <div class="mt-2">
          <For each={pendingRows()}>
            {(row, index) => (
              <div class="flex items-center gap-3 border-b border-border py-2.5 last:border-b-0">
                <span class="w-4 text-sm font-bold text-text-secondary tabular-nums">{index() + 1}</span>
                <InitialsCircle name={row.name} />
                <div class="min-w-0 flex-1">
                  <p class="truncate font-bold">{row.name}</p>
                  <p class="text-xs text-text-secondary tabular-nums">
                    {renewsLabel(row)}
                    {" · "}
                    {formatEth(row.costEth, 4)}
                  </p>
                </div>
                <Show
                  when={row.daysLeft !== undefined}
                  fallback={<span class="tag grey text-xs">{t("pools.unknownExpiry")}</span>}
                >
                  <Show when={isWindowOpen(row)} fallback={<span class="tag grey text-xs">{t("pools.queued")}</span>}>
                    <span class="tag yellow text-xs tabular-nums">
                      waiting for gas &lt;
                      {" "}
                      {properties.pool.gasCeilingGwei}
                      {" "}
                      gwei
                    </span>
                  </Show>
                </Show>
              </div>
            )}
          </For>
        </div>

        <Show
          when={coveredCount() === pendingRows().length}
          fallback={(
            <p class="mt-3 text-sm font-bold text-red-primary tabular-nums">
              {t("pools.coverageShortfall", {
                amount: formatEth(shortfallEth(), 4),
                covered: coveredCount(),
                total: pendingRows().length,
              })}
            </p>
          )}
        >
          <p class="mt-3 text-sm font-bold text-green-primary tabular-nums">
            {t("pools.coverageComplete", { count: pendingRows().length })}
          </p>
        </Show>
      </Show>
    </section>
  );
};

export const PoolInflowsCard = (properties: { canManagePool: boolean; isConnected: boolean; pool: Pool; yearlyTotalEth: number; }) => {
  const suggestedMonthlyEth = createMemo(() => (properties.yearlyTotalEth * (1 + properties.pool.bufferPercent / 100)) / 12);

  return (
    <section class="card p-5" data-testid="pool-inflows">
      <h3 class="flex items-center gap-2 text-lg font-bold">
        Inflows
        <span class="tag yellow text-xs">Superfluid</span>
      </h3>

      <div class="mt-4 flex gap-6">
        <div>
          <p class="font-bold tabular-nums">
            {properties.pool.hasStreaming ? `${formatEth(suggestedMonthlyEth(), 5)}/mo` : "—"}
          </p>
          <p class="text-xs font-bold text-text-secondary">{t("pools.totalIncoming")}</p>
        </div>
        <div>
          <p class="font-bold tabular-nums">
            {properties.pool.hasStreaming ? `${formatEth(suggestedMonthlyEth(), 5)}/mo` : "—"}
          </p>
          <p class="text-xs font-bold text-text-secondary">{t("pools.fromYou")}</p>
        </div>
        <div>
          <p class="font-bold tabular-nums">
            {formatEth(suggestedMonthlyEth(), 5)}
            /mo
          </p>
          <p class="text-xs font-bold text-text-secondary">{t("pools.suggested")}</p>
        </div>
      </div>

      <Show
        when={properties.pool.hasStreaming}
        fallback={<p class="mt-4 text-sm text-text-secondary">{t("pools.streams")}</p>}
      >
        <div class="mt-3 flex items-center gap-3 border-y border-border py-2.5">
          <InitialsCircle name="you" />
          <span class="flex items-center gap-2 font-bold">
            Your stream
            <span class="tag blue text-xs">{t("pools.you")}</span>
          </span>
          <span class="ml-auto text-sm text-text-secondary tabular-nums">
            {formatEth(suggestedMonthlyEth(), 5)}
            /mo
          </span>
        </div>
      </Show>

      <Show when={properties.canManagePool}>
        <p class="mt-4 text-sm text-text-secondary">{t("pools.ownerSetsBuffer")}</p>
      </Show>
      <Show when={properties.isConnected}>
        <p class="mt-4 rounded-button bg-background-secondary p-3 text-sm text-text-secondary">{t("pools.streamingUnavailable")}</p>
      </Show>
    </section>
  );
};
