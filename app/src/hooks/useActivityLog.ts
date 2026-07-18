import { createStoredSignal } from "../utils/storage";

export type ActivityStepStatus = "active" | "done" | "failed" | "pending";

export type ActivityStep = {
  detail?: string;
  key: string;
  label: string;
  status: ActivityStepStatus;
};

export type ActivityStatus = "failed" | "in-progress" | "success";

export type ActivityKind = "pool" | "registration" | "renewal";

export type ActivityEntry = {
  activityId: string;
  createdAtMs: number;
  detail?: string;
  kind: ActivityKind;
  status: ActivityStatus;
  steps: ActivityStep[];
  title: string;
  txHashes: string[];
  updatedAtMs: number;
};

const MAX_ENTRIES = 100;

const isActivityEntry = (raw: unknown): raw is ActivityEntry => {
  if (typeof raw !== "object" || raw === null) return false;

  const candidate = raw as Partial<ActivityEntry>;

  return typeof candidate.activityId === "string"
    && typeof candidate.title === "string"
    && typeof candidate.createdAtMs === "number"
    && typeof candidate.status === "string"
    && Array.isArray(candidate.steps)
    && Array.isArray(candidate.txHashes);
};

const parseEntries = (raw: unknown): ActivityEntry[] | undefined => {
  if (!Array.isArray(raw)) return;

  return raw.filter(isActivityEntry);
};

const [entries, setEntries] = createStoredSignal<ActivityEntry[]>({
  defaultValue: [],
  parse: parseEntries,
  storageKey: "ens-manager-activity",
});

const recordActivity = (
  entry: Omit<ActivityEntry, "activityId" | "createdAtMs" | "updatedAtMs">,
): string => {
  const activityId = crypto.randomUUID();
  const now = Date.now();

  setEntries(previous => [
    { ...entry, activityId, createdAtMs: now, updatedAtMs: now },
    ...previous,
  ].slice(0, MAX_ENTRIES));

  return activityId;
};

const updateActivity = (activityId: string, update: (entry: ActivityEntry) => ActivityEntry) => {
  setEntries(previous => previous.map(entry => (entry.activityId === activityId
    ? { ...update(entry), updatedAtMs: Date.now() }
    : entry)));
};

const inProgress = () => entries().filter(entry => entry.status === "in-progress");

const history = () => entries().filter(entry => entry.status !== "in-progress");

export const useActivityLog = () => ({
  entries,
  history,
  inProgress,
  recordActivity,
  updateActivity,
});
