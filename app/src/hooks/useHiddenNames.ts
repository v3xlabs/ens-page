import { createStoredSignal } from "../utils/storage";

type HiddenNamesStore = Record<string, string[]>;

const parseStore = (raw: unknown): HiddenNamesStore | undefined => {
  if (typeof raw !== "object" || raw === null) return;

  return Object.fromEntries(
    Object.entries(raw)
      .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].every(name => typeof name === "string")),
  );
};

const [store, setStore] = createStoredSignal<HiddenNamesStore>({
  defaultValue: {},
  parse: parseStore,
  storageKey: "ens-manager-hidden-names",
});

const getHiddenNamesForAddress = (address: string | undefined) => (address ? store()[address.toLowerCase()] ?? [] : []);

const hideNameForAddress = (address: string, name: string) => {
  const key = address.toLowerCase();
  const normalized = name.toLowerCase();

  setStore(previous => ({
    ...previous,
    [key]: [...new Set([...(previous[key] ?? []), normalized])],
  }));
};

const unhideNameForAddress = (address: string, name: string) => {
  const key = address.toLowerCase();
  const normalized = name.toLowerCase();

  setStore((previous) => {
    const next = (previous[key] ?? []).filter(hidden => hidden !== normalized);

    return next.length > 0
      ? { ...previous, [key]: next }
      : Object.fromEntries(Object.entries(previous).filter(([storedKey]) => storedKey !== key));
  });
};

export const useHiddenNames = () => ({ getHiddenNamesForAddress, hideNameForAddress, unhideNameForAddress });
