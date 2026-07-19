import { useBalance, useConnection } from "@wagmi/solid";
import { TbOutlineCopy, TbOutlineExternalLink } from "solid-icons/tb";
import { createMemo, createSignal, For, Show } from "solid-js";
import { formatEther, getAddress, isAddress, parseEther } from "viem";

import { useEnsName } from "../hooks/useEnsName";
import { useNameExpiries } from "../hooks/useNameExpiries";
import { useOwnedNames } from "../hooks/useOwnedNames";
import { usePoolAdapters, usePoolStreams } from "../hooks/usePoolAdapters";
import { type Pool, usePools } from "../hooks/usePools";
import { useRenewalPool } from "../hooks/useRenewalPools";
import { useTransaction } from "../hooks/useTransaction";
import { shortenAddress } from "../utils/ens";
import { PoolBalanceChart } from "./pool-balance-chart";
import {
  CapabilityChips,
  formatEth,
  poolStatus,
  poolYearlyTotalEth,
  RunwayBar,
  runwayPercent,
  useYearlyCostsEth,
} from "./pool-card";
import { PoolConfigCard } from "./pool-config-card";
import {
  InitialsCircle,
  PoolFundingHistoryCard,
  PoolLabelEditor,
  PoolPendingCard,
} from "./pool-detail-cards";
import { PoolDetailTabs } from "./pool-detail-tabs";
import { buildFundingSummary, copyAddress, formatExpiryDate } from "./pool-format";
import { PoolFundFlow } from "./pool-fund-flow";
import { PoolFundingModal } from "./pool-funding-modal";
import { PoolNamesEditor } from "./pool-names-editor";
import { PoolStreamsCard } from "./pool-streams-card";

export const PoolDetail = (properties: { onBack: () => void; pool: Pool; }) => {
  const { updatePool } = usePools();
  const connection = useConnection();
  const { getNamesForAddress } = useOwnedNames();
  const transaction = useTransaction();

  const [amountInput, setAmountInput] = createSignal("");
  const [isFundingOpen, setIsFundingOpen] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<"overview" | "funding">("overview");

  const poolAddress = createMemo(() => (isAddress(properties.pool.poolId) ? getAddress(properties.pool.poolId) : undefined));
  const onchainPool = useRenewalPool(poolAddress);
  const poolEnsName = useEnsName(poolAddress);
  const onchainBalance = useBalance(() => ({
    address: poolAddress(),
    query: { enabled: poolAddress() !== undefined },
  }));
  const adapters = usePoolAdapters(poolAddress);
  const streamAdapterAddress = createMemo(() => adapters.data?.find(adapter => adapter.kind === "stream")?.address);
  const streams = usePoolStreams(streamAdapterAddress, poolAddress);

  const monthlyStreamEth = createMemo(() => {
    const nowSeconds = Date.now() / 1000;

    return (streams.data ?? [])
      .filter(stream => stream.token === "0x0000000000000000000000000000000000000000" && nowSeconds < stream.stopTime)
      .reduce((sum, stream) => sum + (Number(formatEther(stream.totalAmount)) / (stream.stopTime - stream.startTime)) * 2_592_000, 0);
  });

  const ownedNameSet = createMemo(() => new Set(
    getNamesForAddress(connection().address).map(owned => owned.name.toLowerCase()),
  ));

  const members = createMemo(() => {
    const labels = onchainPool.labels.data;

    if (!labels) return properties.pool.members;

    return labels.map((label) => {
      const name = `${label}.eth`;

      return { isOwned: ownedNameSet().has(name.toLowerCase()), name };
    });
  });

  const memberNames = createMemo(() => members().map(member => member.name));
  const costs = useYearlyCostsEth(memberNames);
  const expiries = useNameExpiries(memberNames);

  const isConnected = createMemo(() => connection().address !== undefined);
  const isPoolOwner = createMemo(() => {
    const connectedAddress = connection().address;
    const owner = onchainPool.owner.data;

    return Boolean(connectedAddress && owner && connectedAddress.toLowerCase() === owner.toLowerCase());
  });

  const balanceEth = createMemo(() => (onchainBalance.data ? Number(formatEther(onchainBalance.data.value)) : properties.pool.balanceEth));

  const yearlyTotalEth = createMemo(() => poolYearlyTotalEth(costs.data, members()));

  const runwayYears = createMemo(() => {
    const yearly = yearlyTotalEth();

    if (yearly <= 0) return;

    return balanceEth() / yearly;
  });

  const status = createMemo(() => poolStatus({ ...properties.pool, balanceEth: balanceEth() }, yearlyTotalEth()));

  const summaryLine = () => {
    if (members().length === 0) return "No names yet";

    const yearly = yearlyTotalEth();

    if (yearly <= 0) return "Fetching renewal prices…";

    return `${formatEth(yearly, 4)}/yr · ${members().length} name${members().length === 1 ? "" : "s"} · ~${(runwayYears() ?? 0).toFixed(1)}y`;
  };

  const parsedAmountEth = () => {
    const value = Number(amountInput());

    if (!Number.isFinite(value) || value <= 0) return;

    return value;
  };

  const handleWithdraw = async () => {
    const amountEth = parsedAmountEth();

    if (amountEth === undefined) return;

    const address = poolAddress();
    const recipient = connection().address;

    if (address && recipient) {
      const hash = await transaction.send(onchainPool.prepareWithdrawEth(recipient, parseEther(String(amountEth))));

      if (!hash) return;

      await onchainBalance.refetch();
      setAmountInput("");

      return;
    }

    updatePool(properties.pool.poolId, pool => ({
      ...pool,
      balanceEth: Math.max(0, pool.balanceEth - amountEth),
    }));
    setAmountInput("");
    closeFunding();
  };

  const openWithdraw = () => {
    transaction.preview();
    setIsFundingOpen(true);
  };

  const closeFunding = () => {
    setIsFundingOpen(false);
    transaction.reset();
  };

  const poolDisplay = () => {
    const address = poolAddress();

    return address ? shortenAddress(address) : properties.pool.label;
  };

  const fundingSummary = () => {
    const recipient = connection().address;

    return buildFundingSummary({
      action: "withdraw",
      amountEth: amountInput(),
      poolDisplay: poolDisplay(),
      recipient: recipient ? shortenAddress(recipient) : undefined,
    });
  };

  const sortedDeposits = createMemo(() => [...properties.pool.deposits].sort((first, second) => second.atMs - first.atMs));

  return (
    <>
      <div class="space-y-4">
        <button class="button subtle" onClick={() => properties.onBack()} type="button">
          ‹ All pools
        </button>

        <section class="card p-5 sm:p-6 space-y-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <Show when={poolEnsName.data?.name}>
                  {name => <h2 class="text-2xl font-bold tracking-tight">{name()}</h2>}
                </Show>
                <PoolLabelEditor label={properties.pool.label} poolId={properties.pool.poolId} />
                <span class={`tag ${status().tagClass}`}>{status().label}</span>
              </div>
              <Show when={poolAddress()}>
                {address => (
                  <div class="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <span class="font-mono text-text-secondary">{address()}</span>
                    <button aria-label="Copy pool address" class="icon-button small" onClick={() => copyAddress(address())} type="button">
                      <TbOutlineCopy size={14} />
                    </button>
                    <a
                      aria-label="View pool on Etherscan"
                      class="icon-button small"
                      href={`https://etherscan.io/address/${address()}`}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <TbOutlineExternalLink size={14} />
                    </a>
                  </div>
                )}
              </Show>
            </div>
            <div class="text-right">
              <p class="text-xs font-bold text-text-secondary uppercase">Pool balance</p>
              <p class="mt-1 text-3xl font-bold tabular-nums">
                {balanceEth().toFixed(4)}
                {" "}
                ETH
              </p>
              <p class="mt-1 text-sm text-text-secondary">
                Stream incoming
                {" "}
                <span class="font-bold tabular-nums">
                  {monthlyStreamEth().toFixed(4)}
                  {" "}
                  ETH/mo
                </span>
              </p>
              <p class="mt-1 text-sm text-text-secondary tabular-nums">{summaryLine()}</p>
              <div class="mt-2 flex flex-wrap justify-end gap-1.5">
                <CapabilityChips pool={properties.pool} />
              </div>
              <div class="max-w-xs">
                <RunwayBar isLow={status().label === "Needs top-up"} percent={runwayPercent(runwayYears())} />
              </div>
            </div>
          </div>

          <div class="pb-4">
            <PoolBalanceChart balanceEth={balanceEth()} yearlyCostEth={yearlyTotalEth()} />
          </div>

          <div class="flex justify-end items-end gap-4 border-t border-border pt-4">
            <Show when={isConnected()}>
              <div class="flex flex-wrap justify-end items-center gap-2">
                <PoolFundFlow onDeposited={() => void onchainBalance.refetch()} pool={properties.pool} poolAddress={poolAddress} />
                <Show when={isPoolOwner()}>
                  <button class="button subtle" data-testid="pool-withdraw" onClick={openWithdraw} type="button">Withdraw</button>
                </Show>
              </div>
            </Show>
          </div>

        </section>

        <PoolDetailTabs activeTab={activeTab()} onChange={setActiveTab} />

        <Show when={activeTab() === "overview"}>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="order-3 sm:col-start-2">
              <PoolPendingCard costsEth={costs.data} expiries={expiries.data} pool={{ ...properties.pool, balanceEth: balanceEth(), members: members() }} />
            </div>

            <section class="card order-1 p-5 sm:row-span-2">
              <div class="flex items-center justify-between gap-3">
                <h3 class="text-lg font-bold">
                  Names
                  {" "}
                  <span class="text-sm font-normal text-text-secondary">
                    (
                    {members().length}
                    )
                  </span>
                </h3>
                <Show when={isPoolOwner()}>
                  <PoolNamesEditor names={() => members().map(member => member.name)} poolAddress={poolAddress} />
                </Show>
              </div>

              <div class="mt-2">
                <For each={members()}>
                  {member => (
                    <div class="flex items-center gap-3 border-b border-border py-2.5 last:border-b-0">
                      <InitialsCircle name={member.name} />
                      <div class="min-w-0 flex-1">
                        <p class="truncate font-bold">{member.name}</p>
                        <p class="text-xs text-text-secondary tabular-nums">
                          {formatExpiryDate(expiries.data?.[member.name] ?? 0)}
                          {" · "}
                          {formatEth(costs.data?.[member.name] ?? 0, 4)}
                          /yr
                        </p>
                      </div>
                      <Show when={!member.isOwned}>
                        <span class="tag grey text-xs">not yours</span>
                      </Show>
                    </div>
                  )}
                </For>
              </div>

            </section>

            <PoolConfigCard
              isOwner={isPoolOwner()}
              onEthChanged={() => void onchainBalance.refetch()}
              pool={properties.pool}
              poolAddress={poolAddress}
            />

          </div>
        </Show>

        <Show when={activeTab() === "funding"}>
          <div class="space-y-4">
            <PoolStreamsCard
              onClaimed={() => void onchainBalance.refetch()}
              streamAdapter={streamAdapterAddress}
              streams={streams.data ?? []}
            />
            <PoolFundingHistoryCard deposits={sortedDeposits()} />
          </div>
        </Show>
      </div>

      <PoolFundingModal
        action="withdraw"
        amount={amountInput()}
        isOpen={isFundingOpen()}
        onAmountInput={setAmountInput}
        onClose={closeFunding}
        onConfirm={() => void handleWithdraw()}
        state={transaction.state()}
        summary={fundingSummary()}
      />
    </>
  );
};
