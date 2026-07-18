import { For, Show } from "solid-js";

import { type ActivityStep, useActivityLog } from "../hooks/useActivityLog";

const chipClassByStatus: Record<ActivityStep["status"], string> = {
  active: "tag yellow",
  done: "tag green",
  failed: "tag bg-red-surface text-red-primary",
  pending: "tag grey",
};

const markerByStatus: Record<ActivityStep["status"], string> = {
  active: "●",
  done: "✓",
  failed: "✕",
  pending: "○",
};

const relativeTime = (timestampMs: number) => {
  const elapsedMs = Math.max(0, Date.now() - timestampMs);

  if (elapsedMs < 60_000) return "just now";

  const minutes = Math.floor(elapsedMs / 60_000);

  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours}h ago`;

  return `${Math.floor(hours / 24)}d ago`;
};

const truncateHash = (hash: string) => `${hash.slice(0, 6)}…${hash.slice(-4)}`;

const stepChipText = (step: ActivityStep) => {
  const base = `${markerByStatus[step.status]} ${step.label}`;

  return step.detail === undefined ? base : `${base} · ${step.detail}`;
};

const StepChip = (properties: { step: ActivityStep; }) => (
  <span class={`${chipClassByStatus[properties.step.status]} tabular-nums`}>
    {stepChipText(properties.step)}
  </span>
);

export const ActivityFlows = () => {
  const { inProgress } = useActivityLog();

  return (
    <Show when={inProgress().length > 0}>
      <section aria-label="In-progress flows" class="card">
        <For each={inProgress()}>
          {entry => (
            <article
              class="border-b border-border p-5 last:border-b-0 sm:p-6"
              data-testid={`activity-flow-${entry.activityId}`}
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h3 class="text-lg font-bold">{entry.title}</h3>
                <span class="tag yellow">in progress</span>
              </div>
              <Show when={entry.detail}>
                {detail => <p class="mt-1 text-sm text-text-secondary">{detail()}</p>}
              </Show>
              <div class="mt-3 flex flex-wrap gap-1.5">
                <For each={entry.steps}>{step => <StepChip step={step} />}</For>
              </div>
              <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary">
                <span class="tabular-nums">{`Started ${relativeTime(entry.createdAtMs)}`}</span>
                <For each={entry.txHashes}>
                  {hash => (
                    <a
                      class="font-mono text-blue-primary hover:underline"
                      href={`https://etherscan.io/tx/${hash}`}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {truncateHash(hash)}
                    </a>
                  )}
                </For>
              </div>
              <p class="mt-3 text-sm text-text-secondary">
                Safe to close this tab — the flow is saved locally and resumes in any tab.
              </p>
            </article>
          )}
        </For>
      </section>
    </Show>
  );
};
