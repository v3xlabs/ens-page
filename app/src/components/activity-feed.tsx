import { createMemo, For, Show } from "solid-js";

import { type ActivityEntry, useActivityLog } from "../hooks/useActivityLog";
import { t } from "../i18n";

const DAY_MS = 86_400_000;

const iconByKind: Record<ActivityEntry["kind"], string> = {
  pool: "⬡",
  registration: "＋",
  renewal: "⟳",
};

const dotClass = (entry: ActivityEntry) => {
  if (entry.status === "failed") return "bg-red-surface text-red-primary";

  if (entry.kind === "pool") return "bg-blue-surface text-blue-primary";

  return "bg-green-surface text-green-primary";
};

const dotIcon = (entry: ActivityEntry) => (entry.status === "failed" ? "⚠" : iconByKind[entry.kind]);

const startOfDayMs = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const dayLabel = (timestampMs: number) => {
  const date = new Date(timestampMs);
  const today = new Date();
  const dayDiff = Math.round((startOfDayMs(today) - startOfDayMs(date)) / DAY_MS);

  if (dayDiff === 0) return "Today";

  if (dayDiff === 1) return "Yesterday";

  const isSameYear = date.getFullYear() === today.getFullYear();

  return date.toLocaleDateString("en-US", isSameYear
    ? { day: "numeric", month: "short" }
    : { day: "numeric", month: "short", year: "numeric" });
};

const timeLabel = (timestampMs: number) => new Date(timestampMs)
  .toLocaleTimeString("en-US", { hour: "2-digit", hour12: false, minute: "2-digit" });

type FeedGroup = {
  entries: ActivityEntry[];
  label: string;
};

export const ActivityFeed = () => {
  const { history } = useActivityLog();

  const groups = createMemo<FeedGroup[]>(() => {
    const sorted = [...history()].sort((first, second) => second.updatedAtMs - first.updatedAtMs);
    const result: FeedGroup[] = [];

    for (const entry of sorted) {
      const label = dayLabel(entry.updatedAtMs);
      const currentGroup = result.at(-1);

      if (currentGroup && currentGroup.label === label) currentGroup.entries.push(entry);
      else result.push({ entries: [entry], label });
    }

    return result;
  });

  return (
    <Show
      fallback={(
        <section class="card p-5 sm:p-6">
          <h2 class="text-xl font-bold">{t("activity.noActivity")}</h2>
        </section>
      )}
      when={groups().length > 0}
    >
      <section aria-label={t("activity.history")} class="card pb-2">
        <For each={groups()}>
          {group => (
            <div>
              <p class="px-5 pb-1 pt-4 text-xs font-bold uppercase tracking-wider text-text-secondary sm:px-6">
                {group.label}
              </p>
              <For each={group.entries}>
                {entry => (
                  <div class="flex items-start gap-3 border-b border-border px-5 py-3.5 last:border-b-0 sm:px-6">
                    <span
                      aria-hidden="true"
                      class={`grid size-8 flex-none place-items-center rounded-full text-sm ${dotClass(entry)}`}
                    >
                      {dotIcon(entry)}
                    </span>
                    <div class="min-w-0 flex-1">
                      <p class="font-bold">{entry.title}</p>
                      <Show when={entry.detail !== undefined || entry.txHashes.length > 0}>
                        <p class="mt-0.5 text-sm text-text-secondary tabular-nums">
                          {entry.detail}
                          <Show when={entry.detail !== undefined && entry.txHashes.length > 0}> · </Show>
                          <Show when={entry.txHashes[0]}>
                            {hash => (
                              <a
                                class="text-blue-primary hover:underline"
                                href={`https://etherscan.io/tx/${hash()}`}
                                rel="noopener noreferrer"
                                target="_blank"
                              >
                                view tx
                              </a>
                            )}
                          </Show>
                        </p>
                      </Show>
                    </div>
                    <span class="text-sm text-text-secondary tabular-nums">
                      {timeLabel(entry.updatedAtMs)}
                    </span>
                  </div>
                )}
              </For>
            </div>
          )}
        </For>
      </section>
    </Show>
  );
};
