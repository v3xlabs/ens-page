import { TbOutlinePencil } from "solid-icons/tb";
import { type Accessor, createSignal, Show } from "solid-js";
import type { Address } from "viem";
import { formatEther, parseEther, parseGwei } from "viem";

import { type Pool, usePools } from "../hooks/usePools";
import { useRenewalPool } from "../hooks/useRenewalPools";
import { useTransaction } from "../hooks/useTransaction";
import { shortenAddress } from "../utils/ens";
import { PoolAdaptersCard } from "./pool-adapters-card";
import {
  ConfigStopSlider,
  RENEWAL_DURATION_STOPS_DAYS,
  RENEWAL_WINDOW_STOPS_DAYS,
} from "./pool-detail-cards";
import { buildConfigSummary } from "./pool-format";
import { TransactionModal } from "./transaction-modal";

const ConfigField = (properties: { label: string; onInput: (value: string) => void; testId: string; value: string; }) => (
  <label class="grid gap-1 text-sm font-bold text-text-secondary">
    {properties.label}
    <input class="input tabular-nums" data-testid={properties.testId} min="0" onInput={event => properties.onInput(event.currentTarget.value)} step="any" type="number" value={properties.value} />
  </label>
);

const ConfigRow = (properties: { label: string; value: string; }) => (
  <div class="flex items-center justify-between gap-3">
    <span class="font-bold text-text-secondary">{properties.label}</span>
    <span>{properties.value}</span>
  </div>
);

type PoolConfigCardProperties = {
  isOwner: boolean;
  onEthChanged: () => void;
  pool: Pool;
  poolAddress: Accessor<Address | undefined>;
};

export const PoolConfigCard = (properties: PoolConfigCardProperties) => {
  const { updatePool } = usePools();
  const transaction = useTransaction();
  const onchainPool = useRenewalPool(properties.poolAddress);

  const [isEditing, setIsEditing] = createSignal(false);
  const [isReviewOpen, setIsReviewOpen] = createSignal(false);
  const [durationDaysInput, setDurationDaysInput] = createSignal("365");
  const [renewalWindowDaysInput, setRenewalWindowDaysInput] = createSignal("30");
  const [gasCeilingGweiInput, setGasCeilingGweiInput] = createSignal("15");
  const [premiumEthInput, setPremiumEthInput] = createSignal("0");

  const openEditor = () => {
    // A fresh pool reports renewalDuration 0, which the factory's duration
    // allow-list always rejects — prefill with the standard year instead.
    const storedDuration = onchainPool.renewalDuration.data;

    setDurationDaysInput(String(Number(storedDuration && storedDuration > 0n ? storedDuration : 31_536_000n) / 86_400));
    setRenewalWindowDaysInput(String(Number(onchainPool.renewalThreshold.data ?? 2_592_000n) / 86_400));
    setGasCeilingGweiInput(String(Number(onchainPool.gasPriceCap.data ?? 15_000_000_000n) / 1_000_000_000));
    setPremiumEthInput(formatEther(onchainPool.premium.data ?? 0n));
    setIsEditing(true);
  };

  const openReview = () => {
    const durationDays = Number(durationDaysInput());
    const renewalWindowDays = Number(renewalWindowDaysInput());
    const gasCeilingGwei = Number(gasCeilingGweiInput());

    if (!Number.isFinite(durationDays) || !Number.isFinite(renewalWindowDays) || !Number.isFinite(gasCeilingGwei)) return;

    transaction.preview();
    setIsReviewOpen(true);
  };

  const closeReview = () => {
    setIsReviewOpen(false);
    transaction.reset();
  };

  const confirmSave = async () => {
    const address = properties.poolAddress();

    if (!address) {
      updatePool(properties.pool.poolId, pool => ({
        ...pool,
        gasCeilingGwei: Number(gasCeilingGweiInput()),
        renewHorizonDays: Number(renewalWindowDaysInput()),
      }));
      closeReview();
      setIsEditing(false);

      return;
    }

    const hash = await transaction.send(onchainPool.prepareConfigurePool(
      BigInt(Number(durationDaysInput()) * 86_400),
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
    setIsEditing(false);
  };

  const poolDisplay = () => {
    const address = properties.poolAddress();

    return address ? shortenAddress(address) : properties.pool.label;
  };

  const configSummary = () => buildConfigSummary({
    durationDays: durationDaysInput(),
    gasCeilingGwei: gasCeilingGweiInput(),
    poolDisplay: poolDisplay(),
    premiumEth: premiumEthInput(),
    renewalWindowDays: renewalWindowDaysInput(),
  });

  return (
    <section class="card order-2 p-5 sm:col-start-2">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-lg font-bold">Pool configuration</h3>
        <Show when={properties.isOwner}>
          <button aria-label="Edit pool configuration" class="icon-button small" data-testid="pool-config-edit" onClick={openEditor} type="button"><TbOutlinePencil size={15} /></button>
        </Show>
      </div>
      <Show
        when={isEditing()}
        fallback={(
          <div class="mt-4 grid gap-3 text-sm">
            <ConfigRow label="Renewal duration" value={`${Number(onchainPool.renewalDuration.data ?? 31_536_000n) / 86_400} days`} />
            <ConfigRow label="Renewal window" value={`${Number(onchainPool.renewalThreshold.data ?? 2_592_000n) / 86_400} days before expiry`} />
            <ConfigRow label="Gas ceiling" value={`${Number(onchainPool.gasPriceCap.data ?? 15_000_000_000n) / 1_000_000_000} gwei`} />
            <ConfigRow label="Relayer premium" value={`${formatEther(onchainPool.premium.data ?? 0n)} ETH`} />
          </div>
        )}
      >
        <div class="mt-4 grid gap-3">
          <ConfigStopSlider
            format={days => `${days} days`}
            label="Renewal duration"
            onChange={days => setDurationDaysInput(String(days))}
            stops={RENEWAL_DURATION_STOPS_DAYS}
            testId="pool-config-duration"
            value={Number(durationDaysInput())}
          />
          <ConfigStopSlider
            format={days => `${days} days before expiry`}
            label="Renewal window"
            onChange={days => setRenewalWindowDaysInput(String(days))}
            stops={RENEWAL_WINDOW_STOPS_DAYS}
            testId="pool-config-window"
            value={Number(renewalWindowDaysInput())}
          />
          <ConfigField label="Gas ceiling (gwei)" testId="pool-config-gas" value={gasCeilingGweiInput()} onInput={setGasCeilingGweiInput} />
          <ConfigField label="Relayer premium (ETH)" testId="pool-config-premium" value={premiumEthInput()} onInput={setPremiumEthInput} />
          <div class="flex justify-end gap-2">
            <button class="button subtle" onClick={() => setIsEditing(false)} type="button">Cancel</button>
            <button class="button primary" data-testid="pool-config-save" onClick={openReview} type="button">Save</button>
          </div>
        </div>
      </Show>

      <PoolAdaptersCard
        isOwner={properties.isOwner}
        onEthChanged={() => properties.onEthChanged()}
        poolAddress={properties.poolAddress}
      />

      <TransactionModal
        isOpen={isReviewOpen()}
        onClose={closeReview}
        onConfirm={() => void confirmSave()}
        state={transaction.state()}
        summary={configSummary()}
        title="Update pool configuration"
      >
        <p class="mt-4 text-sm text-text-secondary">
          Writes the renewal schedule and relayer limits to the pool contract. Relayers can
          only renew within these bounds.
        </p>
      </TransactionModal>
    </section>
  );
};
