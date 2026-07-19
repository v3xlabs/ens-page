import { useNavigate } from "@tanstack/solid-router";
import { TbOutlineSearch } from "solid-icons/tb";
import { createMemo, createSignal, For, Show } from "solid-js";

import { useSearchCache } from "../hooks/useSearchCache";
import { t } from "../i18n";
import { buildSearchResults, type SearchResult } from "../utils/search";
import { NameAvatar } from "./name-avatar";

export const SearchBar = () => {
  const [query, setQuery] = createSignal("");
  const [focused, setFocused] = createSignal(false);
  const navigate = useNavigate();
  const { addToCache, cache } = useSearchCache();

  const results = createMemo(() => buildSearchResults(query(), cache()));

  const handleSelect = (result: SearchResult) => {
    setQuery("");
    setFocused(false);

    if (result.type === "page") {
      void navigate({ to: result.path });
    }
    else {
      addToCache(result.name);
      void navigate({ params: { name: result.name }, to: "/$name" });
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Enter" && results().length > 0) {
      handleSelect(results()[0]);
    }
  };

  return (
    <div class="relative">
      <div class="relative">
        <TbOutlineSearch
          class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary"
          size={20}
        />
        <input
          class="input with-leading-icon"
          data-testid="search-input"
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          onFocus={() => setFocused(true)}
          onInput={event => setQuery(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("search.placeholder")}
          type="text"
          value={query()}
        />
      </div>
      <Show when={focused() && query().trim()}>
        <div class="card absolute left-0 right-0 top-full z-10 mt-2 border border-border p-2 shadow-lg">
          <Show
            when={results().length > 0}
            fallback={<p class="p-4 text-center text-sm text-text-secondary">{t("search.noResults")}</p>}
          >
            <For each={results()}>
              {result => (
                <button
                  class="flex w-full items-center gap-3 rounded-button px-3 py-2.5 text-left font-bold transition-colors hover:bg-background-secondary"
                  onClick={() => handleSelect(result)}
                  type="button"
                >
                  <Show when={result.type !== "page" && result.name}>
                    {resultName => <NameAvatar name={resultName()} />}
                  </Show>
                  {result.label}
                </button>
              )}
            </For>
          </Show>
        </div>
      </Show>
    </div>
  );
};
