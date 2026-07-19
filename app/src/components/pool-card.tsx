import { useChainId, useClient } from "@wagmi/solid";
import { useQuery } from "@wagmi/solid/query";
import { type Accessor, createMemo, Show } from "solid-js";
import { formatEther } from "viem/utils";

import type { Pool, PoolMember } from "../hooks/usePools";
import { t } from "../i18n";
import { fetchRenewalQuote, SECONDS_PER_YEAR } from "../utils/renewal";

// Real controller rent prices, quoted per name for one year.
export const useYearlyCostsEth = (names: Accessor<string[]>) => {
  const chainId = useChainId();
  const client = useClient(() => ({ chainId: chainId() }));

  return useQuery<Record<string, number>, Error, Record<string, number>, readonly ["yearlyRenewalCosts", number, string]>(() => ({
    enabled: names().length > 0,
    queryFn: async (): Promise<Record<string, number>> => {
      const publicClient = client();

      if (!publicClient) return {};

      const uniqueNames = [...new Set(names())];

      const entries = await Promise.all(uniqueNames.map(async (name) => {
        const quote = await fetchRenewalQuote(publicClient, [name], SECONDS_PER_YEAR).catch(() => {});

        return [name, quote ? Number(formatEther(quote.pricePerNameWei)) : 0] as const;
      }));

      return Object.fromEntries(entries);
    },
    queryKey: ["yearlyRenewalCosts", chainId(), [...names()].sort().join(",")] as const,
  }));
};

export const formatEth = (value: number, maximumFractionDigits = 4) =>
  `${value.toLocaleString("en-US", { maximumFractionDigits })} ETH`;

export const poolYearlyTotalEth = (costs: Record<string, number> | undefined, members: PoolMember[]) =>
  members.reduce((sum, member) => sum + (costs?.[member.name] ?? 0), 0);

export type PoolStatus = {
  label: "Funded" | "Needs top-up" | "Streaming";
  tagClass: "green" | "red" | "yellow";
};

export const poolStatus = (pool: Pool, yearlyTotalEth: number): PoolStatus => {
  if (pool.hasStreaming) return { label: "Streaming", tagClass: "yellow" };

  if (pool.balanceEth >= yearlyTotalEth) return { label: "Funded", tagClass: "green" };

  return { label: "Needs top-up", tagClass: "red" };
};

export const CapabilityChips = (properties: { pool: Pool; }) => (
  <>
    <Show when={properties.pool.hasStreaming}>
      <span class="tag yellow text-xs">{t("pools.stream")}</span>
    </Show>
    <Show when={properties.pool.hasUsdcSwap}>
      <span class="tag bg-[#ffe4f0] text-xs text-[#c9256e] dark:bg-[#3d2231] dark:text-[#ff7ab2]">{t("pools.tokenFunding")}</span>
    </Show>
  </>
);

export const RunwayBar = (properties: { isLow: boolean; percent: number; }) => (
  <div class="h-2 w-full overflow-hidden rounded-full bg-background-secondary">
    <div
      classList={{
        "bg-green-primary": !properties.isLow,
        "bg-red-primary": properties.isLow,
        "h-full rounded-full transition-[width]": true,
      }}
      style={{ width: `${properties.percent}%` }}
    />
  </div>
);

// Runway maps to the bar at ~3 years of funding = full width.
export const runwayPercent = (runwayYears: number | undefined) =>
  (runwayYears === undefined ? 0 : Math.min(100, runwayYears * 33));

export const PoolCard = (properties: { onOpen: () => void; pool: Pool; }) => {
  const memberNames = createMemo(() => properties.pool.members.map(member => member.name));
  const costs = useYearlyCostsEth(memberNames);

  const yearlyTotalEth = createMemo(() => poolYearlyTotalEth(costs.data, properties.pool.members));

  const runwayYears = createMemo(() => {
    const yearly = yearlyTotalEth();

    if (yearly <= 0) return;

    return properties.pool.balanceEth / yearly;
  });

  const status = createMemo(() => poolStatus(properties.pool, yearlyTotalEth()));

  const runwayLabel = () => {
    const runway = runwayYears();

    if (runway === undefined) return "—";

    return `${runway.toFixed(1)}y`;
  };

  return (
    <div
      class="card cursor-pointer border border-transparent p-5 text-left transition-colors hover:border-blue-primary focus-visible:ring-2 focus-visible:ring-blue-primary focus-visible:outline-none"
      data-testid={`pool-card-${properties.pool.poolId}`}
      onClick={() => properties.onOpen()}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;

        event.preventDefault();
        properties.onOpen();
      }}
      role="button"
      tabindex="0"
    >
      <div class="flex items-center justify-between gap-2">
        <h3 class="truncate text-lg font-bold">{properties.pool.label}</h3>
        <span class={`tag ${status().tagClass} text-xs`}>{status().label}</span>
      </div>

      <Show when={properties.pool.hasStreaming || properties.pool.hasUsdcSwap}>
        <div class="mt-2.5 flex flex-wrap gap-1.5">
          <CapabilityChips pool={properties.pool} />
        </div>
      </Show>

      <div class="mt-4 flex gap-6">
        <div>
          <p class="text-lg font-bold tabular-nums">{properties.pool.members.length}</p>
          <p class="text-xs font-bold text-text-secondary">{t("pools.names")}</p>
        </div>
        <div>
          <p class="text-lg font-bold tabular-nums">{formatEth(properties.pool.balanceEth, 3)}</p>
          <p class="text-xs font-bold text-text-secondary">{t("pools.balance")}</p>
        </div>
        <div>
          <p class="text-lg font-bold tabular-nums">{runwayLabel()}</p>
          <p class="text-xs font-bold text-text-secondary">{t("pools.runway")}</p>
        </div>
      </div>

      <div class="mt-3">
        <RunwayBar isLow={status().label === "Needs top-up"} percent={runwayPercent(runwayYears())} />
      </div>
    </div>
  );
};
