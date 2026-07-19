import { Area, Axis, Chart, Line } from "solid-charts";
import { createMemo } from "solid-js";

import { t } from "../i18n";

type PoolBalanceChartProperties = {
  balanceEth: number;
  yearlyCostEth: number;
};

const MONTHS_SHOWN = 12;

export const PoolBalanceChart = (properties: PoolBalanceChartProperties) => {
  const projectedBalances = createMemo(() => {
    const monthlyCostEth = properties.yearlyCostEth / 12;

    return Array.from(
      { length: MONTHS_SHOWN + 1 },
      (_, month) => Math.max(0, properties.balanceEth - monthlyCostEth * month),
    );
  });

  return (
    <div class="h-28 min-w-52 flex-1">
      <Chart
        aria-label={t("pools.balanceOutlook")}
        class="size-full"
        data={projectedBalances()}
        inset={{ bottom: 2, left: 2, right: 2, top: 6 }}
      >
        <defs>
          <linearGradient id="pool-balance-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="var(--thorin-blue-primary)" stop-opacity="0.35" />
            <stop offset="100%" stop-color="var(--thorin-blue-primary)" stop-opacity="0.02" />
          </linearGradient>
        </defs>
        <Axis axis="x" position="bottom" />
        <Axis axis="y" axisRange={[0, "max"]} position="left" />
        <Area fill="url(#pool-balance-fill)" stroke="none" />
        <Line
          class="text-blue-primary"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2.5"
        />
      </Chart>
      <div class="mt-1 flex justify-between text-xs font-bold text-text-secondary">
        <span>{t("pools.now")}</span>
        <span>{t("pools.months")}</span>
      </div>
    </div>
  );
};
