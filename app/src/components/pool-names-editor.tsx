import { Dialog } from "@kobalte/core/dialog";
import { TbOutlinePlus, TbOutlineSearch, TbOutlineX } from "solid-icons/tb";
import { type Accessor, createMemo, createSignal, For, Show } from "solid-js";
import type { Address } from "viem";

import { useRenewalPool } from "../hooks/useRenewalPools";
import { useSearchCache } from "../hooks/useSearchCache";
import { useTransaction } from "../hooks/useTransaction";
import { normalizeName, shortenAddress } from "../utils/ens";
import { buildSearchResults, type SearchResult } from "../utils/search";
import { NameAvatar } from "./name-avatar";
import { TransactionModal, type TransactionSummaryRow } from "./transaction-modal";

type PoolNamesEditorProperties = {
  names: Accessor<string[]>;
  poolAddress: Accessor<Address | undefined>;
};

type NameSearchResult = Extract<SearchResult, { type: "lookup" | "name"; }>;

const isAvailableEthName = (result: SearchResult): result is NameSearchResult =>
  result.type !== "page" && result.name.endsWith(".eth");

export const PoolNamesEditor = (properties: PoolNamesEditorProperties) => {
  const { cache } = useSearchCache();
  const pool = useRenewalPool(properties.poolAddress);
  const transaction = useTransaction();
  const [input, setInput] = createSignal("");
  const [isOpen, setIsOpen] = createSignal(false);
  const [isReviewOpen, setIsReviewOpen] = createSignal(false);
  const [initialNames, setInitialNames] = createSignal<string[]>([]);
  const [draftNames, setDraftNames] = createSignal<string[]>([]);

  const suggestions = createMemo(() => buildSearchResults(input(), cache())
    .filter(isAvailableEthName)
    .filter(result => !draftNames().includes(result.name)));
  const additions = createMemo(() => draftNames().filter(name => !initialNames().includes(name)));
  const removals = createMemo(() => initialNames().filter(name => !draftNames().includes(name)));
  const hasChanges = createMemo(() => additions().length > 0 || removals().length > 0);

  const openEditor = (open: boolean) => {
    if (open) {
      const names = properties.names();

      setInitialNames(names);
      setDraftNames(names);
      setInput("");
    }

    setIsOpen(open);
  };

  const addName = (rawName: string) => {
    const normalized = normalizeName(rawName);

    if (!normalized || !normalized.endsWith(".eth") || draftNames().includes(normalized)) return;

    setDraftNames(previous => [...previous, normalized]);
    setInput("");
  };

  const removeName = (name: string) => setDraftNames(previous => previous.filter(candidate => candidate !== name));

  const reviewChanges = () => {
    if (!hasChanges()) return;

    transaction.preview();
    setIsOpen(false);
    setIsReviewOpen(true);
  };

  const closeReview = () => {
    setIsReviewOpen(false);
    transaction.reset();
  };

  const reviewSummary = (): TransactionSummaryRow[] => {
    const address = properties.poolAddress();

    return [
      { label: "Action", value: "Update pool names" },
      ...(address ? [{ label: "Pool", value: shortenAddress(address) }] : []),
      ...(additions().length > 0 ? [{ label: "Adding", value: String(additions().length) }] : []),
      ...(removals().length > 0 ? [{ label: "Removing", value: String(removals().length) }] : []),
    ];
  };

  const confirmChanges = async () => {
    const request = pool.prepareLabelUpdate(
      additions().map(name => name.slice(0, -4)),
      removals().map(name => name.slice(0, -4)),
    );
    const hash = await transaction.send(request);

    if (hash) await pool.labels.refetch();
  };

  return (
    <>
      <button aria-label="Add or remove pool names" class="icon-button small" data-testid="pool-names-edit" onClick={() => openEditor(true)} type="button">
        <TbOutlinePlus size={16} />
      </button>

      <Dialog open={isOpen()} onOpenChange={openEditor}>
        <Dialog.Portal>
          <Dialog.Overlay class="dialog-overlay" />
          <div class="dialog-positioner">
            <Dialog.Content class="dialog-content max-h-[calc(100vh-2rem)] overflow-y-auto">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <Dialog.Title class="text-xl font-bold">Edit pool names</Dialog.Title>
                  <Dialog.Description class="mt-1 text-sm text-text-secondary">Stage additions and removals, then review one on-chain update.</Dialog.Description>
                </div>
                <Dialog.CloseButton aria-label="Close name editor" class="icon-button small" type="button"><TbOutlineX size={16} /></Dialog.CloseButton>
              </div>

              <div class="relative mt-5">
                <TbOutlineSearch class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
                <input
                  class="input with-leading-icon"
                  data-testid="pool-names-input"
                  onInput={event => setInput(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && suggestions().at(0)) addName(suggestions()[0].name);
                  }}
                  placeholder="Add a .eth name"
                  type="text"
                  value={input()}
                />
                <Show when={input().trim() && suggestions().length > 0}>
                  <div class="card absolute left-0 right-0 top-full z-10 mt-2 border border-border p-2 shadow-lg">
                    <For each={suggestions()}>
                      {result => (
                        <button class="flex w-full items-center gap-3 rounded-button px-3 py-2 text-left font-bold hover:bg-background-secondary" onClick={() => addName(result.name)} type="button">
                          <NameAvatar name={result.name} />
                          {result.name}
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
              </div>

              <div class="mt-5 space-y-2">
                <For each={draftNames()}>
                  {name => (
                    <div class="flex items-center gap-3 rounded-button bg-background-secondary px-3 py-2">
                      <NameAvatar name={name} />
                      <span class="min-w-0 flex-1 truncate font-bold">{name}</span>
                      <button aria-label={`Remove ${name} from draft`} class="icon-button small" data-testid={`pool-names-remove-${name}`} onClick={() => removeName(name)} type="button"><TbOutlineX size={14} /></button>
                    </div>
                  )}
                </For>
              </div>

              <div class="mt-5 flex justify-end">
                <button class="button primary" data-testid="pool-names-review" disabled={!hasChanges()} onClick={reviewChanges} type="button">Review changes</button>
              </div>
            </Dialog.Content>
          </div>
        </Dialog.Portal>
      </Dialog>

      <TransactionModal isOpen={isReviewOpen()} onClose={closeReview} onConfirm={() => void confirmChanges()} state={transaction.state()} summary={reviewSummary()} title="Update pool names">
        <div class="mt-4 space-y-3 text-sm">
          <Show when={additions().length > 0}>
            <div>
              <p class="font-bold text-green-primary">Add</p>
              <p class="mt-1 text-text-secondary">{additions().join(", ")}</p>
            </div>
          </Show>
          <Show when={removals().length > 0}>
            <div>
              <p class="font-bold text-red-primary">Remove</p>
              <p class="mt-1 text-text-secondary">{removals().join(", ")}</p>
            </div>
          </Show>
        </div>
      </TransactionModal>
    </>
  );
};
