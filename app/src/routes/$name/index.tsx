import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { useConnection } from "@wagmi/solid";
import { TbOutlineCopy, TbOutlinePencil } from "solid-icons/tb";
import { createEffect, createMemo, For, Show, Suspense } from "solid-js";

import { EnsfairyBadge } from "../../components/ensfairy-badge";
import { Page } from "../../components/page";
import { ProfileAddress, ProfileAvatar, ProfileBanner, ProfileDetails } from "../../components/profile";
import { useCanEditName } from "../../hooks/useCanEditName";
import { useEnsAddress } from "../../hooks/useEnsAddress";
import { useEnsAddresses } from "../../hooks/useEnsAddresses";
import { useEnsRegistry } from "../../hooks/useEnsRegistry";
import { useEnsTexts } from "../../hooks/useEnsTexts";
import { useOwnedNames } from "../../hooks/useOwnedNames";
import { useSearchCache } from "../../hooks/useSearchCache";
import { normalizeName } from "../../utils/ens";
import { profileKeys, socialKeys } from "../../utils/social";

const copyToClipboard = (value: string) => {
  void navigator.clipboard.writeText(value);
};

export const NamePage = () => {
  const params = Route.useParams();
  const navigate = useNavigate();
  const name = createMemo(() => normalizeName(params().name));
  const connection = useConnection();
  const connectedAddress = createMemo(() => connection().address);
  const ensAddress = useEnsAddress(name);
  const canEdit = useCanEditName(name);
  const isOwnerContext = createMemo(() => Boolean(
    connectedAddress()
    && ensAddress.data?.address
    && connectedAddress()?.toLowerCase() === ensAddress.data?.address?.toLowerCase(),
  ));
  const isDotEth = createMemo(() => name().endsWith(".eth"));
  const { addToCache } = useSearchCache();
  const { addNameForAddress } = useOwnedNames();

  createEffect(() => {
    if (name()) addToCache(name());
  });

  createEffect(() => {
    const address = connectedAddress();

    if (address && isOwnerContext() && isDotEth() && name()) {
      addNameForAddress(address, name());
    }
  });

  return (
    <Show when={name()} fallback={<p class="text-text-secondary">This route is not a valid ENS name.</p>}>
      {nameValue => (
        <section class="grid w-full gap-6">
          <div class="flex w-full items-center justify-between">
            <div />
            <Show when={canEdit.data}>
              <aside class="flex justify-end space-y-6">
                <button
                  class="button primary"
                  data-testid="edit-records"
                  onClick={() => void navigate({ params: { name: nameValue() }, to: "/$name/edit" })}
                  type="button"
                >
                  <TbOutlinePencil class="mr-2 inline-block size-4" />
                  Edit records
                </button>
              </aside>
            </Show>
          </div>
          <div class="min-w-0 space-y-6">
            <div class="card overflow-hidden">
              <Suspense fallback={<SkeletonBar class="h-48 w-full" />}>
                <ProfileBanner name={nameValue()} />
              </Suspense>

              <div class="p-5 sm:p-6">
                <div class="flex items-center gap-4">
                  <Suspense fallback={<SkeletonBar class="size-20 shrink-0 rounded-full" />}>
                    <ProfileAvatar name={nameValue()} />
                  </Suspense>

                  <div class="min-w-0 rounded-md bg-background-primary px-2">
                    <div class="flex items-center gap-2">
                      <h2 class="text-2xl font-bold">{nameValue()}</h2>
                      <EnsfairyBadge name={nameValue()} />
                    </div>
                    <Suspense fallback={<SkeletonBar class="h-4 w-24" />}>
                      <ProfileAddress name={nameValue()} />
                    </Suspense>
                  </div>
                </div>

                <Suspense fallback={(
                  <>
                    <SkeletonBar class="mt-4 h-4 w-3/4" />
                    <div class="mt-4 flex gap-2">
                      <SkeletonBar class="size-10 rounded-button" />
                      <SkeletonBar class="size-10 rounded-button" />
                      <SkeletonBar class="size-10 rounded-button" />
                    </div>
                  </>
                )}
                >
                  <ProfileDetails name={nameValue()} />
                </Suspense>
              </div>
            </div>

            <Suspense fallback={<RecordsCardFallback />}>
              <AddressesCard name={nameValue()} />
            </Suspense>

            <Suspense fallback={<RecordsCardFallback />}>
              <TextRecordsCard name={nameValue()} />
            </Suspense>

            <Suspense fallback={<RecordsCardFallback />}>
              <InfrastructureCard name={nameValue()} />
            </Suspense>
          </div>
        </section>
      )}
    </Show>
  );
};

const SkeletonBar = (properties: { class?: string; }) => <div class={`animate-pulse rounded bg-background-disabled ${properties.class ?? ""}`} />;

const RecordsCardFallback = () => (
  <div class="card p-5 sm:p-6">
    <SkeletonBar class="h-5 w-24 rounded-full" />
    <div class="mt-5 grid gap-3">
      <SkeletonBar class="h-14 rounded-button" />
      <SkeletonBar class="h-14 rounded-button" />
    </div>
  </div>
);

type RecordsCardProperties = {
  name: string;
};

const AddressesCard = (properties: RecordsCardProperties) => {
  const records = useEnsAddresses(() => properties.name);

  const visible = createMemo(() => records.data?.filter(record => record.value) ?? []);

  return (
    <div class="card p-5 sm:p-6">
      <span class="tag green">Addresses</span>
      <div class="mt-5 grid gap-3">
        <Show when={visible().length > 0} fallback={<p class="text-text-secondary">No address records found.</p>}>
          <For each={visible()}>
            {record => (
              <RecordRow
                copyValue={record.decoded ?? record.value}
                label={record.label}
                value={record.decoded ?? record.value}
              />
            )}
          </For>
        </Show>
      </div>
    </div>
  );
};

const InfrastructureCard = (properties: RecordsCardProperties) => {
  const registry = useEnsRegistry(() => properties.name);

  return (
    <div class="card p-5 sm:p-6">
      <span class="tag grey">Infrastructure</span>
      <h3 class="mt-4 text-xl font-bold">Resolver and registry</h3>
      <div class="mt-5 grid gap-3">
        <RecordRow copyValue={registry.data?.registry} label="Registry" value={registry.data?.registry} />
        <RecordRow copyValue={registry.data?.resolver} label="Resolver" value={registry.data?.resolver} />
      </div>
    </div>
  );
};

const TextRecordsCard = (properties: RecordsCardProperties) => {
  const texts = useEnsTexts(() => properties.name);

  const visible = createMemo(
    () => texts.data?.filter(record => record.value && !socialKeys.has(record.key) && !profileKeys.has(record.key)) ?? [],
  );

  return (
    <Show when={visible().length > 0}>
      <div class="card p-5 sm:p-6">
        <span class="tag yellow">Text records</span>
        <div class="mt-5 grid gap-3">
          <For each={visible()}>
            {record => <RecordRow label={record.label} value={record.value} />}
          </For>
        </div>
      </div>
    </Show>
  );
};

type RecordRowProperties = {
  copyValue?: string;
  label: string;
  value?: string;
};

const RecordRow = (properties: RecordRowProperties) => (
  <div class="flex items-center justify-between rounded-button bg-background-secondary px-4 py-3">
    <div class="min-w-0 flex-1">
      <p class="text-sm font-bold text-text-secondary">{properties.label}</p>
      <p class="mt-1 break-all font-bold">{properties.value ?? "Not set"}</p>
    </div>
    <Show when={properties.copyValue}>
      {copyValue => (
        <button
          aria-label={`Copy ${properties.label}`}
          class="icon-button ml-2 size-8 shrink-0"
          onClick={() => copyToClipboard(copyValue())}
          type="button"
        >
          <TbOutlineCopy size={16} />
        </button>
      )}
    </Show>
  </div>
);

export const Route = createFileRoute("/$name/")({
  component: () => <Page width="wide"><NamePage /></Page>,
});
