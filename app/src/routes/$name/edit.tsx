import { useQueryClient } from "@tanstack/solid-query";
import { createFileRoute, Link } from "@tanstack/solid-router";
import { TbOutlineArrowLeft } from "solid-icons/tb";
import { createMemo, createSignal, For, Show, Suspense } from "solid-js";

import { Page } from "../../components/page";
import { TransactionModal, type TransactionSummaryRow } from "../../components/transaction-modal";
import { useCanEditName } from "../../hooks/useCanEditName";
import { useEnsRegistry } from "../../hooks/useEnsRegistry";
import { type EnsTextRecord, useEnsTexts } from "../../hooks/useEnsTexts";
import { useTransaction } from "../../hooks/useTransaction";
import { t } from "../../i18n";
import { normalizeName, prepareSetTexts, shortenAddress, type TextRecordChange } from "../../utils/ens";
import { defaultTextRecords } from "../../utils/records";

const profileFields = defaultTextRecords.filter(record => !record.key.includes("."));
const socialFields = defaultTextRecords.filter(record => record.key.includes("."));

const recordLabel = (key: string) => defaultTextRecords.find(record => record.key === key)?.label ?? key;

export const EditPage = () => {
  const params = Route.useParams();
  const name = createMemo(() => normalizeName(params().name));
  const registry = useEnsRegistry(name);
  const texts = useEnsTexts(name);
  const canEditQuery = useCanEditName(name);
  const transaction = useTransaction();
  const queryClient = useQueryClient();

  const [drafts, setDrafts] = createSignal<Record<string, string>>({});
  const [showModal, setShowModal] = createSignal(false);
  // Captured when review opens so the modal keeps describing what was
  // approved after a success clears the drafts.
  const [reviewChanges, setReviewChanges] = createSignal<TextRecordChange[]>([]);
  const [reviewSummary, setReviewSummary] = createSignal<TransactionSummaryRow[]>([]);

  const canEdit = createMemo(() => canEditQuery.data === true);

  const currentValue = (key: string) => texts.data?.find(record => record.key === key)?.value ?? "";

  const draftValue = (key: string) => drafts()[key] ?? currentValue(key);

  const changes = createMemo(() => Object.entries(drafts())
    .filter(([key, value]) => value !== currentValue(key))
    .map(([key, value]) => ({ key, value })));

  const canSave = createMemo(() => canEdit() && changes().length > 0 && Boolean(registry.data?.resolver));

  const handleReview = () => {
    if (!canSave()) return;

    const resolver = registry.data?.resolver;
    const pendingChanges = changes();

    setReviewChanges(pendingChanges);
    setReviewSummary([
      { label: "Name", value: name() },
      { label: "Records changed", value: String(pendingChanges.length) },
      ...(resolver ? [{ label: "Resolver", value: shortenAddress(resolver) }] : []),
    ]);
    transaction.preview();
    setShowModal(true);
  };

  const handleConfirm = async () => {
    const resolver = registry.data?.resolver;

    if (!resolver || changes().length === 0) return;

    const hash = await transaction.send(prepareSetTexts(name(), resolver, changes()));

    if (hash) {
      setDrafts({});
      await queryClient.invalidateQueries({ queryKey: ["ensTexts"] });
    }
  };

  const handleClose = () => {
    setShowModal(false);
    transaction.reset();
  };

  return (
    <Show when={name()} fallback={<p class="text-text-secondary">{t("names.invalid")}</p>}>
      {nameValue => (
        <section class="card p-5 sm:p-6">
          <Link
            class="mb-4 inline-flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
            params={{ name: nameValue() }}
            to="/$name"
          >
            <TbOutlineArrowLeft size={16} />
            Back to
            {" "}
            {nameValue()}
          </Link>

          <h2 class="mt-4 text-3xl font-bold tracking-tight">
            Edit
            {" "}
            {nameValue()}
          </h2>
          <p class="mt-3 max-w-2xl text-text-secondary">
            <Show
              when={canEdit()}
              fallback="Connect a wallet that is allowed to edit this name's records on its resolver."
            >
              Update text records, then review and sign a single transaction.
            </Show>
          </p>

          <Suspense fallback={<p class="mt-8 text-text-secondary">{t("records.loading")}</p>}>
            <div class="mt-8 space-y-8">
              <RecordFieldGroup
                disabled={!canEdit()}
                draftValue={draftValue}
                fields={profileFields}
                onEdit={(key, value) => setDrafts(previous => ({ ...previous, [key]: value }))}
                title={t("records.profile")}
              />

              <RecordFieldGroup
                disabled={!canEdit()}
                draftValue={draftValue}
                fields={socialFields}
                onEdit={(key, value) => setDrafts(previous => ({ ...previous, [key]: value }))}
                title={t("records.social")}
              />

              <div class="flex items-center justify-between gap-4">
                <p class="text-sm text-text-secondary">
                  <Show when={changes().length > 0} fallback="No pending changes.">
                    {changes().length}
                    {" "}
                    record
                    {changes().length === 1 ? "" : "s"}
                    {" "}
                    changed.
                  </Show>
                </p>
                <div class="flex gap-2">
                  <button
                    class="button subtle"
                    data-testid="edit-reset"
                    disabled={changes().length === 0}
                    onClick={() => setDrafts({})}
                    type="button"
                  >
                    Reset
                  </button>
                  <button
                    class="button primary"
                    data-testid="edit-save"
                    disabled={!canSave()}
                    onClick={handleReview}
                    type="button"
                  >
                    Review & Save
                  </button>
                </div>
              </div>
            </div>
          </Suspense>

          <TransactionModal
            isOpen={showModal()}
            onClose={handleClose}
            onConfirm={() => void handleConfirm()}
            state={transaction.state()}
            summary={reviewSummary()}
            title={t("records.update", { name: nameValue() })}
          >
            <div class="mt-4 space-y-1.5">
              <For each={reviewChanges()}>
                {change => (
                  <div class="flex items-baseline justify-between gap-4 text-sm">
                    <span class="shrink-0 font-bold">{recordLabel(change.key)}</span>
                    <span class="min-w-0 truncate text-right text-text-secondary">
                      {change.value || "(cleared)"}
                    </span>
                  </div>
                )}
              </For>
            </div>
          </TransactionModal>
        </section>
      )}
    </Show>
  );
};

type RecordFieldGroupProperties = {
  disabled: boolean;
  draftValue: (key: string) => string;
  fields: readonly EnsTextRecord[];
  onEdit: (key: string, value: string) => void;
  title: string;
};

const RecordFieldGroup = (properties: RecordFieldGroupProperties) => (
  <div>
    <h3 class="mb-4 text-lg font-bold">{properties.title}</h3>
    <div class="grid gap-4 sm:grid-cols-2">
      <For each={properties.fields}>
        {field => (
          <div>
            <label class="mb-1 block text-sm font-bold text-text-secondary" for={`record-${field.key}`}>
              {field.label}
            </label>
            <input
              class="w-full rounded-button border border-border bg-background-secondary px-4 py-3 text-text-primary placeholder:text-text-secondary disabled:opacity-60"
              data-testid={`record-input-${field.key}`}
              disabled={properties.disabled}
              id={`record-${field.key}`}
              onInput={event => properties.onEdit(field.key, event.currentTarget.value)}
              placeholder={t("records.notSet")}
              value={properties.draftValue(field.key)}
            />
          </div>
        )}
      </For>
    </div>
  </div>
);

export const Route = createFileRoute("/$name/edit")({
  component: () => <Page width="narrow"><EditPage /></Page>,
});
