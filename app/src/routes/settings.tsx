import { createFileRoute } from "@tanstack/solid-router";
import { Show } from "solid-js";

import { Page } from "../components/page";
import { useSearchCache } from "../hooks/useSearchCache";
import { useSettings } from "../hooks/useSettings";

export const SettingsPage = () => {
  const { settings, updateSettings } = useSettings();
  const { cacheSize, clearCache } = useSearchCache();

  return (
    <section class="grid gap-6">
      <div class="card p-5 sm:p-6">
        <span class="tag grey">Settings</span>
        <h2 class="mt-4 text-3xl font-bold tracking-tight">Preferences</h2>
      </div>

      <div class="card p-5 sm:p-6">
        <span class="tag blue">Search</span>
        <h3 class="mt-4 text-xl font-bold">Name search retention</h3>
        <p class="mt-2 text-text-secondary">
          Remember visited ENS names across sessions and show them as quick suggestions in the search and Cmd+K menu.
        </p>
        <div class="mt-5 flex items-center gap-4">
          <button
            class="button"
            classList={{
              primary: settings().nameSearchRetention,
              subtle: !settings().nameSearchRetention,
            }}
            onClick={() => updateSettings({ nameSearchRetention: !settings().nameSearchRetention })}
            type="button"
          >
            {settings().nameSearchRetention ? "Enabled" : "Disabled"}
          </button>
        </div>
      </div>

      <div class="card p-5 sm:p-6">
        <span class="tag yellow">Cache</span>
        <h3 class="mt-4 text-xl font-bold">Visited names</h3>
        <p class="mt-2 text-text-secondary">
          <Show
            when={cacheSize() > 0}
            fallback="No names have been cached yet."
          >
            {cacheSize()}
            {" "}
            {cacheSize() === 1 ? "name" : "names"}
            {" "}
            currently stored in the local search cache.
          </Show>
        </p>
        <Show when={cacheSize() > 0}>
          <div class="mt-5">
            <button
              class="button subtle"
              onClick={() => clearCache()}
              type="button"
            >
              Clear cache
            </button>
          </div>
        </Show>
      </div>
    </section>
  );
};

export const Route = createFileRoute("/settings")({
  component: () => <Page width="narrow"><SettingsPage /></Page>,
});
