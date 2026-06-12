import { Link } from "@tanstack/solid-router";
import { useConnection } from "@wagmi/solid";
import { TbOutlineCheck, TbOutlineChevronDown, TbOutlineRefresh } from "solid-icons/tb";
import { createMemo, createSignal, For, Show } from "solid-js";

import { RenewCart } from "../components/renew-cart";
import { useCart } from "../hooks/useCart";
import { useGraphEnsNames } from "../hooks/useGraphEnsNames";
import { type OwnedName, useOwnedNames } from "../hooks/useOwnedNames";
import { shortenAddress } from "../utils/ens";

const DAY_MS = 24 * 60 * 60 * 1000;
const GRACE_PERIOD_DAYS = 90;

const formatExpiry = (timestamp: number) => {
  if (timestamp === 0) return "Unknown";

  return new Date(timestamp * 1000).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
};

const getDaysUntil = (timestamp: number): number | undefined => {
  if (timestamp === 0) return;

  return Math.ceil((timestamp * 1000 - Date.now()) / DAY_MS);
};

const isPastGracePeriod = (expiryDate: number) => {
  const days = getDaysUntil(expiryDate);

  return days !== undefined && days < -GRACE_PERIOD_DAYS;
};

const ExpiryBadge = (properties: { expiryDate: number; }) => {
  const days = createMemo(() => getDaysUntil(properties.expiryDate));

  const label = () => {
    const remaining = days();

    if (remaining === undefined) return "Unknown expiry";

    if (remaining < 0) return `Expired ${Math.abs(remaining)}d ago`;

    if (remaining < 30) return `${remaining}d left`;

    if (remaining < 365) return `${Math.floor(remaining / 30)}mo left`;

    return `${Math.floor(remaining / 365)}yr left`;
  };

  const badgeClass = () => {
    const remaining = days();

    if (remaining === undefined) return "text-xs text-text-secondary";

    if (remaining < 30) return "text-xs font-bold text-red-primary";

    if (remaining < 365) return "text-xs font-bold text-yellow-active";

    return "text-xs font-bold text-green-primary";
  };

  return <span class={badgeClass()}>{label()}</span>;
};

const NameRowBody = (properties: { expiryDate: number; name: string; }) => (
  <div class="min-w-0 flex-1 text-left">
    <p class="truncate font-bold">{properties.name}</p>
    <div class="mt-1 flex items-center gap-3">
      <ExpiryBadge expiryDate={properties.expiryDate} />
      <span class="text-xs text-text-secondary">{formatExpiry(properties.expiryDate)}</span>
    </div>
  </div>
);

const NameRow = (properties: { owned: OwnedName; selectMode: boolean; }) => {
  const { isSelected, toggleItem } = useCart();
  const selected = createMemo(() => isSelected(properties.owned.name));

  return (
    <Show
      when={properties.selectMode}
      fallback={(
        <Link
          class="flex items-center gap-3 rounded-button border border-border bg-background-secondary p-4 transition-colors hover:border-blue-primary"
          data-testid={`name-row-${properties.owned.name}`}
          params={{ name: properties.owned.name }}
          to="/$name"
        >
          <NameRowBody expiryDate={properties.owned.expiryDate} name={properties.owned.name} />
        </Link>
      )}
    >
      <button
        classList={{
          "border-blue-primary bg-blue-primary/5": selected(),
          "border-border bg-background-secondary hover:border-blue-primary": !selected(),
          "flex w-full cursor-pointer items-center gap-3 rounded-button border p-4 text-left transition-colors": true,
        }}
        data-testid={`name-row-${properties.owned.name}`}
        onClick={() => toggleItem(properties.owned.name, properties.owned.expiryDate)}
        type="button"
      >
        <span
          aria-hidden="true"
          classList={{
            "border-blue-primary bg-blue-primary text-white": selected(),
            "border-border bg-background-primary text-transparent": !selected(),
            "grid size-5 shrink-0 place-items-center rounded-full border-2": true,
          }}
        >
          <TbOutlineCheck size={12} />
        </span>
        <NameRowBody expiryDate={properties.owned.expiryDate} name={properties.owned.name} />
      </button>
    </Show>
  );
};

export const NamesPage = () => {
  const connection = useConnection();
  const { getNamesForAddress } = useOwnedNames();
  const { error, fetchNames, isLoading } = useGraphEnsNames();
  const [filterQuery, setFilterQuery] = createSignal("");
  const [selectMode, setSelectMode] = createSignal(false);
  const [expiredOpen, setExpiredOpen] = createSignal(false);

  const address = createMemo(() => connection().address);

  const sortedNames = createMemo(() => [...getNamesForAddress(address())].sort((a, b) => {
    if (a.expiryDate === 0 && b.expiryDate === 0) return a.name.localeCompare(b.name);

    if (a.expiryDate === 0) return 1;

    if (b.expiryDate === 0) return -1;

    return a.expiryDate - b.expiryDate;
  }));

  const filteredNames = createMemo(() => {
    const query = filterQuery()
      .trim()
      .toLowerCase();

    if (!query) return sortedNames();

    return sortedNames().filter(owned => owned.name.toLowerCase().includes(query));
  });

  const activeNames = createMemo(() => filteredNames().filter(owned => !isPastGracePeriod(owned.expiryDate)));

  const longExpiredNames = createMemo(() => filteredNames().filter(owned => isPastGracePeriod(owned.expiryDate)));

  const handleRefresh = async () => {
    const owner = address();

    if (!owner || isLoading()) return;

    await fetchNames(owner).catch(() => []);
  };

  return (
    <div class="mx-auto w-full max-w-2xl space-y-6">
      <section class="card p-5 sm:p-6">
        <div class="flex items-center justify-between">
          <span class="tag blue">My names</span>
          <Show when={address()}>
            <button
              class="icon-button size-10"
              disabled={isLoading()}
              onClick={() => void handleRefresh()}
              title="Fetch names from the ENS subgraph"
              type="button"
            >
              <TbOutlineRefresh class={isLoading() ? "animate-spin" : ""} size={20} />
            </button>
          </Show>
        </div>

        <h2 class="mt-4 text-3xl font-bold tracking-tight">Owned names</h2>

        <Show when={address()} fallback={<p class="mt-3 text-text-secondary">Connect a wallet to view names.</p>}>
          {owner => (
            <p class="mt-3 text-text-secondary">
              Names owned by
              {" "}
              {shortenAddress(owner())}
            </p>
          )}
        </Show>

        <Show when={error()}>
          {fetchError => (
            <p class="mt-3 text-sm text-red-primary">
              Failed to fetch from the ENS subgraph:
              {" "}
              {fetchError().message}
            </p>
          )}
        </Show>

        <div class="mt-6 flex items-center gap-2">
          <input
            class="input flex-1"
            data-testid="names-search"
            onInput={event => setFilterQuery(event.currentTarget.value)}
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
        </div>

        <Show when={selectMode()}>
          <p class="mt-3 text-sm text-text-secondary">
            Select mode is on: clicking a name adds it to the renewal cart instead of opening it.
          </p>
        </Show>

        <Show when={address()}>
          <div class="mt-6">
            <Show
              when={filteredNames().length > 0}
              fallback={(
                <div class="rounded-card border border-border bg-background-secondary p-8 text-center">
                  <Show
                    when={sortedNames().length > 0}
                    fallback={(
                      <>
                        <p class="text-text-secondary">No names found.</p>
                        <p class="mt-2 text-sm text-text-secondary">
                          Visit a name to track it, or press the refresh button to fetch from the ENS subgraph.
                        </p>
                      </>
                    )}
                  >
                    <p class="text-text-secondary">No names match your filter.</p>
                  </Show>
                </div>
              )}
            >
              <div class="space-y-2">
                <For each={activeNames()}>
                  {owned => <NameRow owned={owned} selectMode={selectMode()} />}
                </For>
              </div>

              <Show when={longExpiredNames().length > 0}>
                <div class="mt-4">
                  <button
                    aria-expanded={expiredOpen()}
                    class="flex w-full cursor-pointer items-center justify-between rounded-button border border-border bg-background-secondary px-4 py-3 text-sm font-bold text-text-secondary transition-colors hover:border-blue-primary"
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
                    <div class="mt-2 space-y-2">
                      <For each={longExpiredNames()}>
                        {owned => <NameRow owned={owned} selectMode={selectMode()} />}
                      </For>
                    </div>
                  </Show>
                </div>
              </Show>
            </Show>
          </div>
        </Show>
      </section>

      <RenewCart />
    </div>
  );
};
