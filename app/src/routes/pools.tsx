import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { useConnection } from "@wagmi/solid";
import { createMemo, createSignal, For, Show } from "solid-js";

import { Page } from "../components/page";
import { PoolCard } from "../components/pool-card";
import { TransactionModal, type TransactionSummaryRow } from "../components/transaction-modal";
import { useOwnedNames } from "../hooks/useOwnedNames";
import { usePools } from "../hooks/usePools";
import { useRenewalPoolFactory } from "../hooks/useRenewalPools";
import { useTransaction } from "../hooks/useTransaction";
import { shortenAddress } from "../utils/ens";

export const PoolsPage = () => {
  const { createPool, poolSeed, pools, setPoolSeed } = usePools();
  const connection = useConnection();
  const navigate = useNavigate();
  const { getNamesForAddress } = useOwnedNames();
  const factory = useRenewalPoolFactory();

  const transaction = useTransaction();
  const [isCreateOpen, setIsCreateOpen] = createSignal(false);
  const [labelInput, setLabelInput] = createSignal("");
  const [depositInput, setDepositInput] = createSignal("");
  const [isCreateReviewOpen, setIsCreateReviewOpen] = createSignal(false);
  const [createdPoolId, setCreatedPoolId] = createSignal<string>();

  const ownedNameSet = createMemo(() => new Set(
    getNamesForAddress(connection().address).map(owned => owned.name.toLowerCase()),
  ));

  const showCreateCard = createMemo(() => isCreateOpen() || poolSeed().length > 0);

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

  const stagedMembers = () => poolSeed().map((name) => {
    const normalized = name.toLowerCase();

    return { isOwned: ownedNameSet().has(normalized), name: normalized };
  });

  const finishCreate = (poolId: string) => {
    setPoolSeed([]);
    setLabelInput("");
    setDepositInput("");
    setIsCreateOpen(false);
    openPool(poolId);
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

    finishCreate(createPool({ balanceEth, label, members: stagedMembers() }));
  };

  const confirmCreate = async () => {
    const poolOwner = connection().address;

    if (!poolOwner) return;

    const hash = await transaction.send(factory.prepareCreatePool(poolOwner));

    if (!hash) return;

    const poolId = await factory.resolveCreatedPool(hash);

    createPool({ balanceEth: 0, label: labelInput().trim(), members: stagedMembers() }, poolId);
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
    <div class="space-y-6">
      <section class="card p-5 sm:p-6">
        <div class="flex flex-wrap items-center gap-4">
          <div class="min-w-56 flex-1">
            <span class="tag grey">{factory.isConfigured ? "local fork · on-chain" : "prototype · stored locally"}</span>
            <h2 class="mt-3 text-2xl font-bold tracking-tight">Pools renew names for you.</h2>
            <p class="mt-2 text-sm text-text-secondary">
              Put names in a pool, keep it funded, and relayers renew them before expiry —
              any name can join, even ones you don&apos;t own.
            </p>
          </div>
          <button
            class="button primary"
            data-testid="pool-create"
            onClick={() => setIsCreateOpen(previous => !previous)}
            type="button"
          >
            Create pool
          </button>
        </div>
      </section>

      <Show when={showCreateCard()}>
        <section class="card p-5 sm:p-6">
          <h3 class="text-lg font-bold">New pool</h3>
          <div class="mt-3 flex flex-wrap gap-2">
            <input
              aria-label="Pool label"
              class="input min-w-44 flex-1"
              data-testid="pool-create-label"
              onInput={event => setLabelInput(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleCreate();
              }}
              placeholder="Pool label (a private note)"
              value={labelInput()}
            />
            <input
              aria-label="Initial deposit in ETH"
              class="input max-w-48 tabular-nums"
              min="0"
              onInput={event => setDepositInput(event.currentTarget.value)}
              placeholder="Initial deposit (ETH)"
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
                Pools are public; the label is a private note only you see. To name a pool
                publicly, point an ENS name at its address once it&apos;s deployed.
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
        </section>
      </Show>

      <Show when={displayedPools().length > 0}>
        <div class="grid gap-4 sm:grid-cols-2">
          <For each={displayedPools()}>
            {pool => <PoolCard onOpen={() => openPool(pool.poolId)} pool={pool} />}
          </For>
        </div>
      </Show>

      <TransactionModal
        isOpen={isCreateReviewOpen()}
        onClose={closeCreateReview}
        onConfirm={() => void confirmCreate()}
        state={transaction.state()}
        summary={createSummary()}
        title="Create renewal pool"
      >
        <p class="mt-4 text-sm text-text-secondary">
          Deploys a new renewal pool contract owned by your wallet. Pool membership and
          configuration are public on chain; the label stays a private note in this browser.
        </p>
      </TransactionModal>
    </div>
  );
};

export const Route = createFileRoute("/pools")({
  component: () => <Page width="narrow"><PoolsPage /></Page>,
});
