import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createMemo, For, Show } from "solid-js";

import { Page } from "../components/page";
import { PoolCard } from "../components/pool-card";
import { usePools } from "../hooks/usePools";
import { useRenewalPoolFactory } from "../hooks/useRenewalPools";

export const PoolsPage = () => {
  const { pools } = usePools();
  const navigate = useNavigate();
  const factory = useRenewalPoolFactory();

  const displayedPools = createMemo(() => {
    if (!factory.isConfigured) return pools();

    return (factory.pools.data ?? []).map((poolId) => {
      const remembered = pools().find(pool => pool.poolId.toLowerCase() === poolId.toLowerCase());

      return remembered ?? {
        balanceEth: 0,
        bufferPercent: 10,
        deposits: [],
        gasCeilingGwei: 15,
        hasStreaming: false,
        hasUsdcSwap: false,
        label: `Pool ${poolId.slice(0, 6)}…${poolId.slice(-4)}`,
        members: [],
        poolId,
        renewHorizonDays: 30,
        tipPercent: 0.5,
      };
    });
  });

  const openPool = (poolId: string) => {
    void navigate({ params: { poolId }, to: "/pool/$poolId" });
  };

  return (
    <Page width="narrow">
      <div class="space-y-6">
        <section class="card p-5 sm:p-6">
          <div class="flex flex-wrap items-center gap-4">
            <div class="min-w-56 flex-1">
              <h2 class="text-2xl font-bold tracking-tight">
                Pools renew names for you.
              </h2>
            </div>
            <button
              class="button primary"
              data-testid="pool-create"
              onClick={() => void navigate({ to: "/pools/new" })}
              type="button"
            >
              Create pool
            </button>
          </div>
        </section>

        <Show when={displayedPools().length > 0}>
          <div class="grid gap-4 sm:grid-cols-2">
            <For each={displayedPools()}>
              {pool => <PoolCard onOpen={() => openPool(pool.poolId)} pool={pool} />}
            </For>
          </div>
        </Show>
      </div>
    </Page>
  );
};

export const Route = createFileRoute("/pools/")({
  component: PoolsPage,
});
