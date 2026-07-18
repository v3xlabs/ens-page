import { Dialog } from "@kobalte/core/dialog";
import { createFileRoute } from "@tanstack/solid-router";
import { useConnection } from "@wagmi/solid";
import { TbOutlineCheck, TbOutlineChevronDown, TbOutlineRefresh } from "solid-icons/tb";
import { createMemo, createSignal, For, Show } from "solid-js";

import { CheckoutPanel } from "../components/checkout-panel";
import { getDaysUntilExpiry, NameRow } from "../components/name-row";
import { Page } from "../components/page";
import { useGraphEnsNames } from "../hooks/useGraphEnsNames";
import { useHiddenNames } from "../hooks/useHiddenNames";
import { useOwnedNames } from "../hooks/useOwnedNames";
import { usePools } from "../hooks/usePools";
import { shortenAddress } from "../utils/ens";

const GRACE_PERIOD_DAYS = 90;
const EXPIRING_SOON_DAYS = 30;
const PAGE_SIZE = 10;

type StatusFilter = "all" | "grace" | "hidden" | "pooled" | "soon";

const isPastGracePeriod = (expiryDate: number) => {
  const days = getDaysUntilExpiry(expiryDate);

  return days !== undefined && days < -GRACE_PERIOD_DAYS;
};

export const Route = createFileRoute("/names")({
  component: () => <Page hasCheckoutClearance width="narrow"><NamesPage /></Page>,
});

const isExpiringSoon = (expiryDate: number) => {
  const days = getDaysUntilExpiry(expiryDate);

  return days !== undefined && days >= 0 && days < EXPIRING_SOON_DAYS;
};

const isInGrace = (expiryDate: number) => {
  const days = getDaysUntilExpiry(expiryDate);

  return days !== undefined && days < 0 && days >= -GRACE_PERIOD_DAYS;
};

export const NamesPage = () => {
  const connection = useConnection();
  const { getNamesForAddress } = useOwnedNames();
  const { getHiddenNamesForAddress, hideNameForAddress, unhideNameForAddress } = useHiddenNames();
  const { pools } = usePools();
  const { error, fetchNames, isLoading } = useGraphEnsNames();
  const [filterQuery, setFilterQuery] = createSignal("");
  const [statusFilter, setStatusFilter] = createSignal<StatusFilter>("all");
  const [selectMode, setSelectMode] = createSignal(false);
  const [expiredOpen, setExpiredOpen] = createSignal(false);
  const [pageIndex, setPageIndex] = createSignal(0);
  const [namePendingHide, setNamePendingHide] = createSignal<string>();

  const address = createMemo(() => connection().address);

  const poolLabelByName = createMemo(() => new Map(
    pools().flatMap(pool => pool.members.map((member): [string, string] => [member.name.toLowerCase(), pool.label])),
  ));

  const poolLabelFor = (name: string) => poolLabelByName().get(name.toLowerCase());
  const hiddenNames = createMemo(() => new Set(getHiddenNamesForAddress(address()).map(name => name.toLowerCase())));
  const isHidden = (name: string) => hiddenNames().has(name.toLowerCase());

  const sortedNames = createMemo(() => [...getNamesForAddress(address())].sort((a, b) => {
    if (a.expiryDate === 0 && b.expiryDate === 0) return a.name.localeCompare(b.name);

    if (a.expiryDate === 0) return 1;

    if (b.expiryDate === 0) return -1;

    return a.expiryDate - b.expiryDate;
  }));

  const searchedNames = createMemo(() => {
    const query = filterQuery()
      .trim()
      .toLowerCase();

    if (!query) return sortedNames();

    return sortedNames().filter(owned => owned.name.toLowerCase().includes(query));
  });

  const visibleNames = createMemo(() => searchedNames().filter(owned => (statusFilter() === "hidden" ? isHidden(owned.name) : !isHidden(owned.name))));

  const activeNames = createMemo(() => visibleNames().filter(owned => !isPastGracePeriod(owned.expiryDate)));

  const longExpiredNames = createMemo(() => visibleNames().filter(owned => isPastGracePeriod(owned.expiryDate)));

  const soonCount = createMemo(() => activeNames().filter(owned => isExpiringSoon(owned.expiryDate)).length);

  const graceCount = createMemo(() => activeNames().filter(owned => isInGrace(owned.expiryDate)).length);

  const pooledCount = createMemo(() => activeNames().filter(owned => poolLabelByName().has(owned.name.toLowerCase())).length);
  const hiddenCount = createMemo(() => searchedNames().filter(owned => isHidden(owned.name)).length);

  const filteredActiveNames = createMemo(() => {
    const filter = statusFilter();

    if (filter === "hidden") return visibleNames();

    if (filter === "all") return activeNames();

    if (filter === "soon") return activeNames().filter(owned => isExpiringSoon(owned.expiryDate));

    if (filter === "grace") return activeNames().filter(owned => isInGrace(owned.expiryDate));

    return activeNames().filter(owned => poolLabelByName().has(owned.name.toLowerCase()));
  });

  const pageCount = createMemo(() => Math.max(1, Math.ceil(filteredActiveNames().length / PAGE_SIZE)));

  const currentPage = createMemo(() => Math.min(pageIndex(), pageCount() - 1));

  const pagedNames = createMemo(() => filteredActiveNames().slice(currentPage() * PAGE_SIZE, (currentPage() + 1) * PAGE_SIZE));

  const pageNumbers = createMemo(() => Array.from({ length: pageCount() }, (_, index) => index + 1));

  const rangeLabel = createMemo(() => {
    const total = filteredActiveNames().length;

    if (total === 0) return "0–0 of 0";

    const start = currentPage() * PAGE_SIZE + 1;
    const end = Math.min(total, start + PAGE_SIZE - 1);

    return `${start}–${end} of ${total}`;
  });

  const handleSearchInput = (value: string) => {
    setFilterQuery(value);
    setPageIndex(0);
  };

  const handleFilterChange = (filter: StatusFilter) => {
    setStatusFilter(filter);
    setPageIndex(0);
  };

  const handleRefresh = async () => {
    const owner = address();

    if (!owner || isLoading()) return;

    await fetchNames(owner).catch(() => []);
  };

  const confirmHide = () => {
    const owner = address();
    const name = namePendingHide();

    if (owner && name) hideNameForAddress(owner, name);

    setNamePendingHide();
    setPageIndex(0);
  };

  const FilterChip = (properties: { count: number; filter: StatusFilter; label: string; }) => (
    <button
      aria-pressed={statusFilter() === properties.filter}
      classList={{
        "border-blue-light bg-blue-surface text-blue-primary": statusFilter() === properties.filter,
        "border-border bg-background-primary text-text-secondary hover:text-text-primary": statusFilter() !== properties.filter,
        "cursor-pointer rounded-full border px-3 py-1 text-sm font-bold transition-colors": true,
      }}
      onClick={() => handleFilterChange(properties.filter)}
      type="button"
    >
      {properties.label}
      <span class="ml-1.5 tabular-nums">{properties.count}</span>
    </button>
  );

  return (
    <div class="space-y-5">
      <header>
        <h2 class="text-3xl font-bold tracking-tight">My names</h2>

        <Show when={address()} fallback={<p class="mt-2 text-text-secondary">Connect a wallet to view names.</p>}>
          {owner => (
            <p class="mt-2 text-text-secondary">
              Names owned by
              {" "}
              {shortenAddress(owner())}
            </p>
          )}
        </Show>

        <Show when={error()}>
          {fetchError => (
            <p class="mt-2 text-sm text-red-primary">
              Failed to fetch from the ENS subgraph:
              {" "}
              {fetchError().message}
            </p>
          )}
        </Show>
      </header>

      <section class="space-y-3">
        <div class="flex items-center gap-2">
          <input
            class="input flex-1"
            data-testid="names-search"
            onInput={event => handleSearchInput(event.currentTarget.value)}
            placeholder="Filter names…"
            type="text"
            value={filterQuery()}
          />
          <button
            aria-pressed={selectMode()}
            classList={{
              button: true,
              primary: selectMode(),
              subtle: !selectMode(),
            }}
            data-testid="select-mode-toggle"
            onClick={() => setSelectMode(previous => !previous)}
            type="button"
          >
            <TbOutlineCheck aria-hidden="true" size={16} />
            Select
          </button>
          <button
            class="icon-button size-10"
            disabled={isLoading()}
            onClick={() => void handleRefresh()}
            title="Fetch names from the ENS subgraph"
            type="button"
          >
            <TbOutlineRefresh class={isLoading() ? "animate-spin" : ""} size={20} />
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <FilterChip count={activeNames().length} filter="all" label="All" />
          <FilterChip count={soonCount()} filter="soon" label="Expiring soon" />
          <FilterChip count={graceCount()} filter="grace" label="In grace" />
          <FilterChip count={pooledCount()} filter="pooled" label="In a pool" />
          <FilterChip count={hiddenCount()} filter="hidden" label="Hidden" />
        </div>

        <Show when={selectMode()}>
          <p class="text-sm text-text-secondary">
            Select mode is on: clicking a name adds it to the renewal cart instead of opening it.
          </p>
        </Show>
      </section>

      <Show when={address()}>
        <Show
          when={filteredActiveNames().length > 0}
          fallback={(
            <div class="card p-10 text-center">
              <Show
                when={sortedNames().length > 0}
                fallback={(
                  <>
                    <p class="font-bold">No names found</p>
                    <p class="mt-2 text-sm text-text-secondary">
                      Visit a name to track it, or press the refresh button to fetch from the ENS subgraph.
                    </p>
                  </>
                )}
              >
                <p class="font-bold">No matches</p>
                <p class="mt-2 text-sm text-text-secondary">No names match your filter.</p>
              </Show>
            </div>
          )}
        >
          <div class="card divide-y divide-border overflow-hidden py-1">
            <For each={pagedNames()}>
              {owned => <NameRow onVisibilityAction={() => (statusFilter() === "hidden" ? unhideNameForAddress(address() ?? "", owned.name) : setNamePendingHide(owned.name))} owned={owned} poolLabel={poolLabelFor(owned.name)} selectMode={selectMode()} visibilityActionLabel={statusFilter() === "hidden" ? "Restore" : "Hide"} />}
            </For>
          </div>
        </Show>

        <div
          class="flex flex-wrap items-center justify-between gap-2 px-1 text-sm font-bold text-text-secondary"
          data-testid="names-pager"
        >
          <span class="tabular-nums">{rangeLabel()}</span>
          <div class="flex flex-wrap items-center gap-1">
            <button
              aria-label="Previous page"
              class="min-w-8 cursor-pointer rounded-lg px-2 py-1.5 font-bold hover:bg-background-secondary hover:text-text-primary disabled:cursor-default disabled:opacity-40"
              disabled={currentPage() === 0}
              onClick={() => setPageIndex(currentPage() - 1)}
              type="button"
            >
              ‹
            </button>
            <For each={pageNumbers()}>
              {pageNumber => (
                <button
                  aria-current={pageNumber === currentPage() + 1 ? "true" : "false"}
                  classList={{
                    "bg-blue-surface text-blue-primary": pageNumber === currentPage() + 1,
                    "hover:bg-background-secondary hover:text-text-primary": pageNumber !== currentPage() + 1,
                    "min-w-8 cursor-pointer rounded-lg px-2 py-1.5 font-bold tabular-nums": true,
                  }}
                  onClick={() => setPageIndex(pageNumber - 1)}
                  type="button"
                >
                  {pageNumber}
                </button>
              )}
            </For>
            <button
              aria-label="Next page"
              class="min-w-8 cursor-pointer rounded-lg px-2 py-1.5 font-bold hover:bg-background-secondary hover:text-text-primary disabled:cursor-default disabled:opacity-40"
              disabled={currentPage() >= pageCount() - 1}
              onClick={() => setPageIndex(currentPage() + 1)}
              type="button"
            >
              ›
            </button>
          </div>
        </div>

        <Show when={statusFilter() !== "hidden" && longExpiredNames().length > 0}>
          <div class="mt-2">
            <button
              aria-expanded={expiredOpen()}
              class="flex w-full cursor-pointer items-center justify-between px-1 py-2 text-sm font-bold text-text-secondary transition-colors hover:text-text-primary"
              data-testid="expired-section-toggle"
              onClick={() => setExpiredOpen(previous => !previous)}
              type="button"
            >
              <span>
                Expired names (
                {longExpiredNames().length}
                )
              </span>
              <TbOutlineChevronDown
                aria-hidden="true"
                classList={{ "rotate-180": expiredOpen(), "transition-transform": true }}
                size={16}
              />
            </button>

            <Show when={expiredOpen()}>
              <div class="card mt-2 divide-y divide-border overflow-hidden py-1">
                <For each={longExpiredNames()}>
                  {owned => <NameRow onVisibilityAction={() => setNamePendingHide(owned.name)} owned={owned} poolLabel={poolLabelFor(owned.name)} selectMode={selectMode()} visibilityActionLabel="Hide" />}
                </For>
              </div>
            </Show>
          </div>
        </Show>
      </Show>

      <CheckoutPanel />

      <Dialog open={Boolean(namePendingHide())} onOpenChange={(open) => { if (!open) setNamePendingHide(); }}>
        <Dialog.Portal>
          <Dialog.Overlay class="dialog-overlay" />
          <div class="dialog-positioner">
            <Dialog.Content class="dialog-content">
              <Dialog.Title class="text-xl font-bold">Hide name?</Dialog.Title>
              <Dialog.Description class="mt-2 text-text-secondary">
                {namePendingHide()}
                {" "}
                will be removed from your default name list in this browser. You can restore it any time from Hidden.
              </Dialog.Description>
              <div class="mt-6 flex justify-end gap-2">
                <Dialog.CloseButton class="button subtle" type="button">Cancel</Dialog.CloseButton>
                <button class="button primary" onClick={confirmHide} type="button">Hide name</button>
              </div>
            </Dialog.Content>
          </div>
        </Dialog.Portal>
      </Dialog>
    </div>
  );
};
