import { createStoredSignal } from "../utils/storage";

export type Settings = {
  nameSearchRetention: boolean;
};

const defaultSettings: Settings = { nameSearchRetention: true };

const parseSettings = (raw: unknown): Settings | undefined => {
  if (typeof raw !== "object" || raw === null) return;

  return { ...defaultSettings, ...(raw as Partial<Settings>) };
};

const [settings, setSettings] = createStoredSignal<Settings>({
  defaultValue: defaultSettings,
  parse: parseSettings,
  storageKey: "ens-manager-settings",
});

const updateSettings = (partial: Partial<Settings>) => {
  setSettings(previous => ({ ...previous, ...partial }));
};

export { settings };

export const useSettings = () => ({ settings, updateSettings });
