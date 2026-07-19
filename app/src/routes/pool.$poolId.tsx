import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/solid-router";
import { createMemo, Show } from "solid-js";

import { Page } from "../components/page";
import { PoolDetail } from "../components/pool-detail";
import { usePools } from "../hooks/usePools";
import { useRenewalPoolFactory } from "../hooks/useRenewalPools";
import { t } from "../i18n";

export const PoolPage = () => {
  const params = useParams({ strict: false });
  const navigate = useNavigate();
  const { pools } = usePools();
  const factory = useRenewalPoolFactory();

  const pool = createMemo(() => {
    const poolId = params()["poolId"];

    if (!poolId) return;

    const remembered = pools().find(candidate => candidate.poolId.toLowerCase() === poolId.toLowerCase());

    if (remembered) return remembered;

    if (!factory.isConfigured || !factory.pools.data?.some(address => address.toLowerCase() === poolId.toLowerCase())) return;

    return {
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

  return (
    <div class="space-y-6">
      <Show
        when={pool()}
        fallback={(
          <section class="card p-5 sm:p-6">
            <h2 class="text-2xl font-bold tracking-tight">{t("pools.notFound")}</h2>
            <p class="mt-2 text-text-secondary">
              This address is not a pool created by the configured factory.
            </p>
            <Link class="button subtle mt-5 inline-flex" to="/pools">
              ‹ All pools
            </Link>
          </section>
        )}
      >
        {selected => <PoolDetail onBack={() => void navigate({ to: "/pools" })} pool={selected()} />}
      </Show>
    </div>
  );
};

export const Route = createFileRoute("/pool/$poolId")({
  component: () => <Page width="wide"><PoolPage /></Page>,
});
