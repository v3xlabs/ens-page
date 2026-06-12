import { Link } from "@tanstack/solid-router";
import { useConnection } from "@wagmi/solid";
import { createMemo, createSignal, For, Show } from "solid-js";

import { NameIdentity } from "../components/name-identity";
import { shortenAddress } from "../config";
import { useEnsAddress, useEnsAvatar, useEnsName } from "../hooks";
import { normalizeName } from "../utils/ens";

const quickActions = [
  "Update profile records",
  "Review expiry",
  "Set primary name",
  "Check resolver",
];

export const HomePage = () => {
  const [nameInput, setNameInput] = createSignal("vitalik.eth");
  const normalizedName = createMemo(() => normalizeName(nameInput()));
  const ensAddress = useEnsAddress(normalizedName);
  const ensAvatar = useEnsAvatar(normalizedName);
  const connection = useConnection();
  const connectedAddress = createMemo(() => connection().address);
  const profileName = useEnsName(connectedAddress);

  return (
    <section class="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
      <div class="card overflow-hidden">
        <div class="border-b border-border bg-blue-surface p-5 sm:p-6">
          <span class="tag blue">Mainnet lookup</span>
          <h2 class="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
            Search, inspect, and prepare ENS changes.
          </h2>
          <p class="mt-4 max-w-2xl text-base text-text-secondary sm:text-lg">
            A minimal frontend-only starting point for name resolution, wallet connection, profile work, renewals, and resolver checks.
          </p>
        </div>

        <div class="grid gap-4 p-5 sm:p-6">
          <label class="grid gap-2">
            <span class="text-sm font-bold text-text-secondary">ENS name</span>
            <input
              class="input"
              value={nameInput()}
              onInput={event => setNameInput(event.currentTarget.value)}
              placeholder="name.eth"
              spellcheck={false}
            />
          </label>

          <div class="rounded-card border border-border bg-background-secondary p-4">
            <Show when={normalizedName()} fallback={<p class="text-text-secondary">Enter a valid ENS name to resolve it.</p>}>
              <Show when={!ensAddress.isLoading} fallback={<p class="text-text-secondary">Resolving ENS records...</p>}>
                <Show
                  when={ensAddress.data}
                  fallback={(
                    <p class="text-text-secondary">
                      No address record found for
                      {" "}
                      {normalizedName()}
                      .
                    </p>
                  )}
                >
                  {address => (
                    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <NameIdentity address={address()} avatar={ensAvatar.data} name={normalizedName()} />
                      <Link to="/$name" params={{ name: normalizedName() }} class="button subtle">
                        Open name
                      </Link>
                    </div>
                  )}
                </Show>
              </Show>
            </Show>
          </div>
        </div>
      </div>

      <aside class="grid gap-6">
        <div class="card p-5 sm:p-6">
          <span class="tag grey">Wallet</span>
          <h2 class="mt-4 text-xl font-bold">Connection state</h2>
          <p class="mt-2 text-text-secondary">
            <Show when={connectedAddress()} fallback="Connect an injected wallet to prepare write actions.">
              {address => `Connected as ${profileName.data ?? shortenAddress(address())}`}
            </Show>
          </p>
        </div>

        <div class="card p-5 sm:p-6">
          <span class="tag yellow">Roadmap</span>
          <h2 class="mt-4 text-xl font-bold">Next app modules</h2>
          <div class="mt-4 grid gap-3">
            <For each={quickActions}>
              {action => (
                <div class="rounded-button border border-border bg-background-secondary px-4 py-3 font-bold">
                  {action}
                </div>
              )}
            </For>
          </div>
        </div>
      </aside>
    </section>
  );
};
