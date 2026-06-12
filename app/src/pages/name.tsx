import { useParams } from "@tanstack/solid-router";
import { useConnection } from "@wagmi/solid";
import { createMemo, Show } from "solid-js";

import { NameIdentity } from "../components/name-identity";
import { shortenAddress } from "../config";
import { useEnsAddress, useEnsAvatar, useEnsName } from "../hooks";
import { normalizeName } from "../utils/ens";

export const NamePage = () => {
  const params = useParams({ strict: false });
  const name = createMemo(() => normalizeName(params()["name"] ?? ""));
  const ensAddress = useEnsAddress(name);
  const ensAvatar = useEnsAvatar(name);
  const connection = useConnection();
  const connectedAddress = createMemo(() => connection().address);
  const profileName = useEnsName(connectedAddress);
  const isOwnerContext = createMemo(() => Boolean(
    connectedAddress()
    && ensAddress.data
    && connectedAddress()?.toLowerCase() === ensAddress.data.toLowerCase(),
  ));

  return (
    <section class="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div class="card overflow-hidden">
        <div class="border-b border-border bg-blue-surface p-5 sm:p-6">
          <span class="tag blue">Name profile</span>
          <h2 class="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">{params()["name"]}</h2>
          <p class="mt-4 max-w-2xl text-text-secondary">
            A route-ready profile page for ownership, records, resolver health, and primary name actions.
          </p>
        </div>
        <div class="grid gap-4 p-5 sm:p-6">
          <Show when={name()} fallback={<p class="text-text-secondary">This route is not a valid ENS name yet.</p>}>
            <Show when={!ensAddress.isLoading} fallback={<p class="text-text-secondary">Resolving owner context...</p>}>
              <Show when={ensAddress.data} fallback={<p class="text-text-secondary">No address record found.</p>}>
                {address => <NameIdentity address={address()} avatar={ensAvatar.data} name={name()} />}
              </Show>
            </Show>
          </Show>
        </div>
      </div>

      <aside class="card p-5 sm:p-6">
        <span class="tag green">Actions</span>
        <h3 class="mt-4 text-xl font-bold">Management</h3>
        <p class="mt-2 text-text-secondary">
          <Show when={connectedAddress()} fallback="Connect the owner wallet to unlock write actions.">
            {address => (isOwnerContext()
              ? "This wallet matches the resolved address."
              : `Connected as ${profileName.data ?? shortenAddress(address())}`)}
          </Show>
        </p>
        <div class="mt-5 grid gap-3">
          <button class="button primary" type="button" disabled={!isOwnerContext()}>
            Edit records
          </button>
          <button class="button subtle" type="button" disabled={!isOwnerContext()}>
            Make primary
          </button>
        </div>
      </aside>
    </section>
  );
};
