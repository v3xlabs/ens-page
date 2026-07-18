import { useBalance, useConnection } from "@wagmi/solid";
import { TbOutlineCopy, TbOutlineExternalLink, TbOutlinePencil } from "solid-icons/tb";
import { createMemo, createSignal, For, Show } from "solid-js";
import { formatEther, getAddress, isAddress, parseEther, parseGwei } from "viem";

import { useEnsName } from "../hooks/useEnsName";
import { useNameExpiries } from "../hooks/useNameExpiries";
import { useOwnedNames } from "../hooks/useOwnedNames";
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
import { InitialsCircle, PoolFundingHistoryCard, PoolLabelEditor, PoolPendingCard, RenewalWindowSlider } from "./pool-detail-cards";
import { PoolDetailTabs } from "./pool-detail-tabs";
import { buildConfigSummary, buildFundingSummary, copyAddress, formatExpiryDate } from "./pool-format";
import { PoolFundingModal } from "./pool-funding-modal";
import { PoolNamesEditor } from "./pool-names-editor";
import { TransactionModal } from "./transaction-modal";

const ConfigField = (properties: { label: string; onInput: (value: string) => void; testId: string; value: string; }) => (
  <label class="grid gap-1 text-sm font-bold text-text-secondary">
    {properties.label}
    <input class="input tabular-nums" data-testid={properties.testId} min="0" onInput={event => properties.onInput(event.currentTarget.value)} step="any" type="number" value={properties.value} />
  </label>
);

export const PoolDetail = (properties: { onBack: () => void; pool: Pool; }) => {
  const { depositToPool, updatePool } = usePools();
  const connection = useConnection();
  const { getNamesForAddress } = useOwnedNames();
  const transaction = useTransaction();

  const [amountInput, setAmountInput] = createSignal("");
  const [fundingAction, setFundingAction] = createSignal<"deposit" | "withdraw">("deposit");
  const [isFundingOpen, setIsFundingOpen] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<"overview" | "funding">("overview");
  const [isConfigEditing, setIsConfigEditing] = createSignal(false);
  const [isConfigReviewOpen, setIsConfigReviewOpen] = createSignal(false);
  const [durationYearsInput, setDurationYearsInput] = createSignal("1");
  const [renewalWindowDaysInput, setRenewalWindowDaysInput] = createSignal("30");
  const [gasCeilingGweiInput, setGasCeilingGweiInput] = createSignal("15");
  const [premiumEthInput, setPremiumEthInput] = createSignal("0");

  const poolAddress = createMemo(() => (isAddress(properties.pool.poolId) ? getAddress(properties.pool.poolId) : undefined));
  const onchainPool = useRenewalPool(poolAddress);
  const poolEnsName = useEnsName(poolAddress);
  const onchainBalance = useBalance(() => ({
    address: poolAddress(),
    query: { enabled: poolAddress() !== undefined },
  }));

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

  const handleTopUp = async () => {
    const amountEth = parsedAmountEth();

    if (amountEth === undefined) return;

    const address = poolAddress();

    if (address) {
      const hash = await transaction.send({ data: "0x", to: address, value: parseEther(String(amountEth)) });

      if (!hash) return;

      await onchainBalance.refetch();
      depositToPool(properties.pool.poolId, amountEth, "direct");
      setAmountInput("");

      return;
    }

    depositToPool(properties.pool.poolId, amountEth, "direct");
    setAmountInput("");
    closeFunding();
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

  const openFunding = (action: "deposit" | "withdraw") => {
    setFundingAction(action);
    transaction.preview();
    setIsFundingOpen(true);
  };

  const closeFunding = () => {
    setIsFundingOpen(false);
    transaction.reset();
  };

  const confirmFunding = async () => {
    await (fundingAction() === "deposit" ? handleTopUp() : handleWithdraw());
  };

  const openConfigEditor = () => {
    // A fresh pool reports renewalDuration 0, which the factory's duration
    // allow-list always rejects — prefill with the standard year instead.
    const storedDuration = onchainPool.renewalDuration.data;

    setDurationYearsInput(String(Number(storedDuration && storedDuration > 0n ? storedDuration : 31_536_000n) / 31_536_000));
    setRenewalWindowDaysInput(String(Number(onchainPool.renewalThreshold.data ?? 2_592_000n) / 86_400));
    setGasCeilingGweiInput(String(Number(onchainPool.gasPriceCap.data ?? 15_000_000_000n) / 1_000_000_000));
    setPremiumEthInput(formatEther(onchainPool.premium.data ?? 0n));
    setIsConfigEditing(true);
  };

  const savePoolConfig = () => {
    const durationYears = Number(durationYearsInput());
    const renewalWindowDays = Number(renewalWindowDaysInput());
    const gasCeilingGwei = Number(gasCeilingGweiInput());

    if (!Number.isFinite(durationYears) || !Number.isFinite(renewalWindowDays) || !Number.isFinite(gasCeilingGwei)) return;

    transaction.preview();
    setIsConfigReviewOpen(true);
  };

  const closeConfigReview = () => {
    setIsConfigReviewOpen(false);
    transaction.reset();
  };

  const confirmConfigSave = async () => {
    const address = poolAddress();

    if (!address) {
      updatePool(properties.pool.poolId, pool => ({
        ...pool,
        gasCeilingGwei: Number(gasCeilingGweiInput()),
        renewHorizonDays: Number(renewalWindowDaysInput()),
      }));
      closeConfigReview();
      setIsConfigEditing(false);

      return;
    }

    const hash = await transaction.send(onchainPool.prepareConfigurePool(
      BigInt(Number(durationYearsInput()) * 31_536_000),
      BigInt(Number(renewalWindowDaysInput()) * 86_400),
      parseGwei(gasCeilingGweiInput()),
      onchainPool.rewardCap.data ?? 0n,
      parseEther(premiumEthInput()),
    ));

    if (!hash) return;

    await Promise.all([
      onchainPool.gasPriceCap.refetch(),
      onchainPool.premium.refetch(),
      onchainPool.renewalDuration.refetch(),
      onchainPool.renewalThreshold.refetch(),
    ]);
    setIsConfigEditing(false);
  };

  const poolDisplay = () => {
    const address = poolAddress();

    return address ? shortenAddress(address) : properties.pool.label;
  };

  const configSummary = () => buildConfigSummary({
    durationYears: durationYearsInput(),
    gasCeilingGwei: gasCeilingGweiInput(),
    poolDisplay: poolDisplay(),
    premiumEth: premiumEthInput(),
    renewalWindowDays: renewalWindowDaysInput(),
  });

  const fundingSummary = () => {
    const recipient = connection().address;

    return buildFundingSummary({
      action: fundingAction(),
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
                <span class="font-bold tabular-nums">0 ETH/mo</span>
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
                <button class="button primary" data-testid="pool-fund" onClick={() => openFunding("deposit")} type="button">Fund pool</button>
                <Show when={isPoolOwner()}>
                  <button class="button subtle" data-testid="pool-withdraw" onClick={() => openFunding("withdraw")} type="button">Withdraw</button>
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

            <section class="card order-2 p-5 sm:col-start-2">
              <div class="flex items-center justify-between gap-3">
                <h3 class="text-lg font-bold">Pool configuration</h3>
                <Show when={isPoolOwner()}>
                  <button aria-label="Edit pool configuration" class="icon-button small" data-testid="pool-config-edit" onClick={openConfigEditor} type="button"><TbOutlinePencil size={15} /></button>
                </Show>
              </div>
              <Show
                when={isConfigEditing()}
                fallback={(
                  <div class="mt-4 grid gap-3 text-sm">
                    <div class="flex items-center justify-between gap-3">
                      <span class="font-bold text-text-secondary">Renewal duration</span>
                      <span>
                        {Number(onchainPool.renewalDuration.data ?? 31_536_000n) / 31_536_000}
                        {" "}
                        year
                      </span>
                    </div>
                    <div class="flex items-center justify-between gap-3">
                      <span class="font-bold text-text-secondary">Renewal window</span>
                      <span>
                        {Number(onchainPool.renewalThreshold.data ?? 2_592_000n) / 86_400}
                        {" "}
                        days before expiry
                      </span>
                    </div>
                    <div class="flex items-center justify-between gap-3">
                      <span class="font-bold text-text-secondary">Gas ceiling</span>
                      <span>
                        {Number(onchainPool.gasPriceCap.data ?? 15_000_000_000n) / 1_000_000_000}
                        {" "}
                        gwei
                      </span>
                    </div>
                    <div class="flex items-center justify-between gap-3">
                      <span class="font-bold text-text-secondary">Relayer premium</span>
                      <span>
                        {formatEther(onchainPool.premium.data ?? 0n)}
                        {" "}
                        ETH
                      </span>
                    </div>
                  </div>
                )}
              >
                <div class="mt-4 grid gap-3">
                  <ConfigField label="Renewal duration (years)" testId="pool-config-duration" value={durationYearsInput()} onInput={setDurationYearsInput} />
                  <RenewalWindowSlider onChange={days => setRenewalWindowDaysInput(String(days))} valueDays={Number(renewalWindowDaysInput())} />
                  <ConfigField label="Gas ceiling (gwei)" testId="pool-config-gas" value={gasCeilingGweiInput()} onInput={setGasCeilingGweiInput} />
                  <ConfigField label="Relayer premium (ETH)" testId="pool-config-premium" value={premiumEthInput()} onInput={setPremiumEthInput} />
                  <div class="flex justify-end gap-2">
                    <button class="button subtle" onClick={() => setIsConfigEditing(false)} type="button">Cancel</button>
                    <button class="button primary" data-testid="pool-config-save" onClick={savePoolConfig} type="button">Save</button>
                  </div>
                </div>
              </Show>

              <div class="mt-5 border-t border-border pt-4">
                <h4 class="font-bold">Adapters</h4>
                <p class="mt-1 text-sm text-text-secondary">No adapters are enabled. This pool currently accepts ETH only; token deposits and streams require an enabled adapter.</p>
              </div>

            </section>

          </div>
        </Show>

        <Show when={activeTab() === "funding"}>
          <PoolFundingHistoryCard deposits={sortedDeposits()} />
        </Show>
      </div>

      <PoolFundingModal
        action={fundingAction()}
        amount={amountInput()}
        isOpen={isFundingOpen()}
        onAmountInput={setAmountInput}
        onClose={closeFunding}
        onConfirm={() => void confirmFunding()}
        state={transaction.state()}
        summary={fundingSummary()}
      />

      <TransactionModal
        isOpen={isConfigReviewOpen()}
        onClose={closeConfigReview}
        onConfirm={() => void confirmConfigSave()}
        state={transaction.state()}
        summary={configSummary()}
        title="Update pool configuration"
      >
        <p class="mt-4 text-sm text-text-secondary">
          Writes the renewal schedule and relayer limits to the pool contract. Relayers can
          only renew within these bounds.
        </p>
      </TransactionModal>
    </>
  );
};
