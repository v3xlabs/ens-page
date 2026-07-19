import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { Link } from "@tanstack/solid-router";
import { TbOutlineCheck, TbOutlineDotsVertical } from "solid-icons/tb";
import { createMemo, Show } from "solid-js";

import { PRICE_PER_YEAR_USD, useCart } from "../hooks/useCart";
import type { OwnedName } from "../hooks/useOwnedNames";
import { isRenewableEthName } from "../utils/renewal";
import { NameAvatar } from "./name-avatar";

const DAY_MS = 24 * 60 * 60 * 1000;

export const getDaysUntilExpiry = (expiryDate: number): number | undefined => {
  if (expiryDate === 0) return;

  return Math.ceil((expiryDate * 1000 - Date.now()) / DAY_MS);
};

const formatExpiry = (expiryDate: number) => new Date(expiryDate * 1000)
  .toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

const tierPriceUsd = (name: string) => {
  const label = name.replace(".eth", "");

  if (label.length <= 3) return PRICE_PER_YEAR_USD["3char"];

  if (label.length === 4) return PRICE_PER_YEAR_USD["4char"];

  return PRICE_PER_YEAR_USD.standard;
};

const ExpiryBadge = (properties: { expiryDate: number; }) => {
  const days = createMemo(() => Math.ceil((properties.expiryDate * 1000 - Date.now()) / DAY_MS));

  const label = () => {
    const remaining = days();

    if (remaining < 0) return `Expired ${Math.abs(remaining)}d ago`;

    if (remaining < 30) return `${remaining}d left`;

    if (remaining < 365) return `${Math.floor(remaining / 30)}mo left`;

    return `${Math.floor(remaining / 365)}yr left`;
  };

  const badgeClass = () => {
    const remaining = days();

    if (remaining < 30) return "text-xs font-bold text-red-primary";

    if (remaining < 365) return "text-xs font-bold text-yellow-active";

    return "text-xs font-bold text-green-primary";
  };

  return <span class={badgeClass()}>{label()}</span>;
};

const NameRowBody = (properties: { expiryDate: number; name: string; poolLabel: string | undefined; }) => (
  <>
    <NameAvatar name={properties.name} size="medium" />
    <div class="min-w-0 flex-1 text-left">
      <p class="truncate font-bold">{properties.name}</p>
      <div class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Show when={properties.expiryDate !== 0}>
          <ExpiryBadge expiryDate={properties.expiryDate} />
          <span class="text-xs text-text-secondary">{formatExpiry(properties.expiryDate)}</span>
        </Show>
        <Show when={isRenewableEthName(properties.name)}>
          <span class="tag grey">
            $
            {tierPriceUsd(properties.name)}
            /yr
          </span>
        </Show>
        <Show when={properties.poolLabel}>
          {label => (
            <span class="tag blue">
              ⬡
              {" "}
              {label()}
            </span>
          )}
        </Show>
      </div>
    </div>
  </>
);

export const NameRow = (properties: { onVisibilityAction?: () => void; owned: OwnedName; poolLabel: string | undefined; selectMode: boolean; visibilityActionLabel?: string; }) => {
  const { isSelected, toggleItem } = useCart();
  const selected = createMemo(() => isSelected(properties.owned.name));
  const canRenew = createMemo(() => isRenewableEthName(properties.owned.name));

  return (
    <Show
      when={properties.selectMode && canRenew()}
      fallback={(
        <div
          classList={{
            "flex items-center gap-2 pr-3 transition-colors": true,
            "hover:bg-background-secondary": !properties.selectMode,
          }}
        >
          <Show
            when={properties.selectMode && !canRenew()}
            fallback={<Link class="min-w-0 flex flex-1 items-center gap-3 px-4 py-3" data-testid={`name-row-${properties.owned.name}`} params={{ name: properties.owned.name }} to="/$name"><NameRowBody expiryDate={properties.owned.expiryDate} name={properties.owned.name} poolLabel={properties.poolLabel} /></Link>}
          >
            <div class="flex min-w-0 flex-1 items-center gap-3 px-4 py-3" data-testid={`name-row-${properties.owned.name}`}>
              <span aria-label="Not renewable" class="relative grid size-5 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-border">
                <span aria-hidden="true" class="absolute left-1/2 top-1/2 h-0.5 w-7 -translate-x-1/2 -translate-y-1/2 rotate-[-45deg] bg-text-secondary" />
              </span>
              <NameRowBody expiryDate={properties.owned.expiryDate} name={properties.owned.name} poolLabel={properties.poolLabel} />
            </div>
          </Show>
          <Show when={properties.onVisibilityAction && properties.visibilityActionLabel}>
            <DropdownMenu placement="bottom-end" gutter={6}>
              <DropdownMenu.Trigger aria-label={`More actions for ${properties.owned.name}`} class="icon-button small" type="button">
                <TbOutlineDotsVertical size={16} />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content class="dropdown-content">
                  <DropdownMenu.Item class="dropdown-item" onSelect={properties.onVisibilityAction}>
                    {properties.visibilityActionLabel}
                    {" "}
                    name
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu>
          </Show>
        </div>
      )}
    >
      <button
        classList={{
          "bg-blue-primary/5 hover:bg-blue-primary/10": selected(),
          "hover:bg-background-secondary": !selected(),
          "flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors": true,
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
        <NameRowBody expiryDate={properties.owned.expiryDate} name={properties.owned.name} poolLabel={properties.poolLabel} />
      </button>
    </Show>
  );
};
