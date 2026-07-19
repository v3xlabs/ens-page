import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { useConnection } from "@wagmi/solid";
import { createMemo, createSignal, Show } from "solid-js";

import { Page } from "../components/page";
import { TransactionModal, type TransactionSummaryRow } from "../components/transaction-modal";
import { useOwnedNames } from "../hooks/useOwnedNames";
import { usePools } from "../hooks/usePools";
import { useRenewalPoolFactory } from "../hooks/useRenewalPools";
import { useTransaction } from "../hooks/useTransaction";
import { t } from "../i18n";
import { shortenAddress } from "../utils/ens";

export const NewPoolPage = () => {
  const { createPool, poolSeed, setPoolSeed } = usePools();
  const connection = useConnection();
  const navigate = useNavigate();
  const { getNamesForAddress } = useOwnedNames();
  const factory = useRenewalPoolFactory();
  const transaction = useTransaction();

  const [labelInput, setLabelInput] = createSignal("");
  const [depositInput, setDepositInput] = createSignal("");
  const [isCreateReviewOpen, setIsCreateReviewOpen] = createSignal(false);
  const [createdPoolId, setCreatedPoolId] = createSignal<string>();

  const ownedNameSet = createMemo(() => new Set(
    getNamesForAddress(connection().address).map(owned => owned.name.toLowerCase()),
  ));

  const members = () => poolSeed().map((name) => {
    const normalized = name.toLowerCase();

    return { isOwned: ownedNameSet().has(normalized), name: normalized };
  });

  const finishCreate = (poolId: string) => {
    setPoolSeed([]);
    void navigate({ params: { poolId }, to: "/pool/$poolId" });
  };

  const handleCreate = () => {
    const label = labelInput().trim();

    if (!label) return;

    if (factory.isConfigured) {
      if (!connection().address) return;

      transaction.preview();
      setIsCreateReviewOpen(true);

      return;
    }

    const deposit = Number(depositInput());
    const balanceEth = Number.isFinite(deposit) && deposit > 0 ? deposit : 0;

    finishCreate(createPool({ balanceEth, label, members: members() }));
  };

  const confirmCreate = async () => {
    const poolOwner = connection().address;

    if (!poolOwner) return;

    const hash = await transaction.send(factory.prepareCreatePool(poolOwner));

    if (!hash) return;

    const poolId = await factory.resolveCreatedPool(hash);

    createPool({ balanceEth: 0, label: labelInput().trim(), members: members() }, poolId);
    setCreatedPoolId(poolId);
  };

  const closeCreateReview = () => {
    setIsCreateReviewOpen(false);
    transaction.reset();

    const poolId = createdPoolId();

    setCreatedPoolId();

    if (poolId) finishCreate(poolId);
  };

  const createSummary = createMemo((): TransactionSummaryRow[] => {
    const poolOwner = connection().address;
    const rows: TransactionSummaryRow[] = [
      { label: "Action", value: "Deploy renewal pool" },
      ...(factory.factoryAddress ? [{ label: "Factory", value: shortenAddress(factory.factoryAddress) }] : []),
      { label: "Pool owner", value: poolOwner ? shortenAddress(poolOwner) : "—" },
      { label: "Label (private note)", value: labelInput().trim() || "—" },
    ];

    if (poolSeed().length > 0) rows.push({ label: "Seeded names", value: String(poolSeed().length) });

    const poolId = createdPoolId();

    if (poolId) rows.push({ label: "Pool address", value: poolId });

    return rows;
  });

  return (
    <section class="card p-5 sm:p-6">
      <h2 class="text-2xl font-bold tracking-tight">{t("pools.new")}</h2>
      <div class="mt-4 flex flex-wrap gap-2">
        <input
          aria-label={t("pools.localNoteLabel")}
          class="input min-w-44 flex-1"
          data-testid="pool-create-label"
          onInput={event => setLabelInput(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleCreate();
          }}
          placeholder={t("pools.localNote")}
          value={labelInput()}
        />
        <input
          aria-label={t("pools.initialDepositLabel")}
          class="input max-w-48 tabular-nums"
          min="0"
          onInput={event => setDepositInput(event.currentTarget.value)}
          placeholder={t("pools.initialDeposit")}
          step="any"
          type="number"
          value={depositInput()}
        />
        <button
          class="button primary"
          data-testid="pool-create-submit"
          disabled={!labelInput().trim()}
          onClick={handleCreate}
          type="button"
        >
          Create
        </button>
      </div>
      <Show
        when={poolSeed().length > 0}
        fallback={(
          <p class="mt-3 text-sm text-text-secondary">
            Pools are public; the label is a private note only you see. To name a pool publicly,
            point an ENS name at its address once it&apos;s deployed.
          </p>
        )}
      >
        <p class="mt-3 text-sm text-text-secondary tabular-nums">
          {poolSeed().length}
          {" "}
          selected name
          {poolSeed().length === 1 ? "" : "s"}
          {" "}
          will be added.
        </p>
      </Show>
      <TransactionModal
        isOpen={isCreateReviewOpen()}
        onClose={closeCreateReview}
        onConfirm={() => void confirmCreate()}
        state={transaction.state()}
        summary={createSummary()}
        title={t("pools.create")}
      >
        <p class="mt-4 text-sm text-text-secondary">
          Deploys a new renewal pool contract owned by your wallet. Pool membership and
          configuration are public on chain; the label stays a private note in this browser.
        </p>
      </TransactionModal>
    </section>
  );
};

export const Route = createFileRoute("/pools/new")({
  component: () => <Page width="narrow"><NewPoolPage /></Page>,
});
