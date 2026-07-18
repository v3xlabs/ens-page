import { createFileRoute, Link } from "@tanstack/solid-router";
import { For, Show } from "solid-js";

import { Page } from "../components/page";
import { SearchBar } from "../components/search-bar";
import { useSearchCache } from "../hooks/useSearchCache";

const RECENT_NAMES_LIMIT = 8;

export const HomePage = () => {
  const { cache } = useSearchCache();
  const recentNames = () => cache().slice(0, RECENT_NAMES_LIMIT);

  return (
    <section class="py-12 text-center sm:py-24">
      <span class="tag blue">Ethereum Name Service</span>
      <h1 class="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
        Find and manage ENS names.
      </h1>
      <p class="mx-auto mt-4 max-w-xl text-base text-text-secondary sm:text-lg">
        Look up any name to inspect its records, edit your profile, and renew your names.
      </p>

      <div class="mt-8 text-left">
        <SearchBar />
      </div>

      <Show when={recentNames().length > 0}>
        <div class="mt-6 flex flex-wrap items-center justify-center gap-2">
          <span class="text-sm font-bold text-text-secondary">Recent:</span>
          <For each={recentNames()}>
            {name => (
              <Link
                class="tag grey transition-colors hover:text-text-primary"
                params={{ name }}
                to="/$name"
              >
                {name}
              </Link>
            )}
          </For>
        </div>
      </Show>
    </section>
  );
};

export const Route = createFileRoute("/")({
  component: () => <Page width="narrow"><HomePage /></Page>,
});
