import { Dialog } from "@kobalte/core/dialog";
import { useNavigate } from "@tanstack/solid-router";
import { TbOutlineSearch } from "solid-icons/tb";
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";

import { useSearchCache } from "../hooks/useSearchCache";
import { buildSearchResults, type SearchResult } from "../utils/search";
import { NameAvatar } from "./name-avatar";

export const CmdK = () => {
  const [open, setOpen] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const navigate = useNavigate();
  const { addToCache, cache } = useSearchCache();
  let inputRef: HTMLInputElement | undefined;

  const handleShortcut = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "k") {
      event.preventDefault();
      setOpen(previous => !previous);
    }
  };

  onMount(() => {
    document.addEventListener("keydown", handleShortcut);
    onCleanup(() => document.removeEventListener("keydown", handleShortcut));
  });

  createEffect(() => {
    if (open()) {
      setQuery("");
      requestAnimationFrame(() => inputRef?.focus());
    }
  });

  const results = createMemo(() => buildSearchResults(query(), cache()));

  createEffect(() => {
    results();
    setSelectedIndex(0);
  });

  const handleSelect = (result: SearchResult) => {
    if (result.type === "page") {
      void navigate({ to: result.path });
    }
    else {
      addToCache(result.name);
      void navigate({ params: { name: result.name }, to: "/$name" });
    }

    setOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const items = results();

    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        setSelectedIndex(previous => Math.min(previous + 1, items.length - 1));

        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        setSelectedIndex(previous => Math.max(previous - 1, 0));

        break;
      }
      case "Enter": {
        event.preventDefault();
        const item = items[selectedIndex()];

        if (item) handleSelect(item);

        break;
      }
      // No default
    }
  };

  return (
    <Dialog open={open()} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay class="dialog-overlay" />
        <div
          class="dialog-positioner"
          style={{
            "align-items": "flex-start",
            "padding-top": "clamp(32px, 15vh, 120px)",
          }}
        >
          <Dialog.Content
            class="dialog-content"
            style={{ overflow: "hidden", padding: "0", width: "min(100%, 560px)" }}
          >
            <div class="flex items-center gap-3 border-b border-border px-4">
              <TbOutlineSearch class="shrink-0 text-text-secondary" size={20} />
              <input
                ref={inputRef}
                class="w-full border-none bg-transparent py-4 text-base font-bold outline-none"
                onInput={event => setQuery(event.currentTarget.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search pages or ENS names…"
                type="text"
                value={query()}
              />
            </div>
            <div class="max-h-80 overflow-y-auto p-2">
              <Show
                when={results().length > 0}
                fallback={<p class="p-6 text-center text-sm text-text-secondary">No results</p>}
              >
                <For each={results()}>
                  {(result, index) => (
                    <button
                      class="flex w-full items-center gap-3 rounded-button px-3 py-2.5 text-left font-bold transition-colors hover:bg-background-secondary"
                      classList={{ "bg-background-secondary": selectedIndex() === index() }}
                      onClick={() => handleSelect(result)}
                      onMouseEnter={() => setSelectedIndex(index())}
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
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
};
