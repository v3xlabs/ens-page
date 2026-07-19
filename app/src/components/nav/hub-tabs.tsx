import { Link, useRouterState } from "@tanstack/solid-router";
import { useConnection } from "@wagmi/solid";
import { createMemo, Show } from "solid-js";

import { useOwnedNames } from "../../hooks/useOwnedNames";
import { usePools } from "../../hooks/usePools";
import { t } from "../../i18n";

const headerClass = (isActive: boolean) =>
  `text-lg font-bold tracking-tight transition-colors ${isActive ? "text-text-primary" : "text-text-secondary hover:text-text-primary"}`;

const Count = (properties: { count: number; }) => (
  <Show when={properties.count > 0}>
    <span class="ml-1.5 align-middle text-sm font-bold text-text-secondary tabular-nums">
      {properties.count}
    </span>
  </Show>
);

export const HubTabs = () => {
  const connection = useConnection();
  const { getNamesForAddress } = useOwnedNames();
  const { pools } = usePools();
  const routerState = useRouterState();

  const pathname = createMemo(() => routerState().location.pathname);
  const nameCount = createMemo(() => getNamesForAddress(connection().address).length);
  const isPoolsActive = createMemo(() => pathname().startsWith("/pool"));

  return (
    <nav aria-label={t("navigation.names")} class="flex items-baseline gap-6">
      <Link
        class={headerClass(pathname() === "/names")}
        data-testid="tab-names"
        to="/names"
      >
        {t("navigation.names")}
        <Count count={nameCount()} />
      </Link>
      <Link
        class={headerClass(isPoolsActive())}
        data-testid="tab-pools"
        to="/pools"
      >
        {t("navigation.pools")}
        <Count count={pools().length} />
      </Link>
      <Link
        class={headerClass(pathname() === "/activity")}
        data-testid="tab-activity"
        to="/activity"
      >
        {t("navigation.activity")}
      </Link>
    </nav>
  );
};
