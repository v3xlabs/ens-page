import { createStoredSignal } from "../utils/storage";

export type OwnedName = {
  expiryDate: number;
  name: string;
};

type OwnedNamesStore = Record<string, OwnedName[]>;

const isOwnedName = (raw: unknown): raw is OwnedName => {
  if (typeof raw !== "object" || raw === null) return false;

  const candidate = raw as Partial<OwnedName>;

  return typeof candidate.name === "string" && typeof candidate.expiryDate === "number";
};

const parseStore = (raw: unknown): OwnedNamesStore | undefined => {
  if (typeof raw !== "object" || raw === null) return;

  return Object.fromEntries(
    Object.entries(raw)
      .filter((entry): entry is [string, OwnedName[]] =>
        Array.isArray(entry[1]) && entry[1].every(isOwnedName)),
  );
};

const [store, setStore] = createStoredSignal<OwnedNamesStore>({
  defaultValue: {},
  parse: parseStore,
  storageKey: "ens-manager-owned-names",
});

const getNamesForAddress = (address: string | undefined): OwnedName[] => {
  if (!address) return [];

  return store()[address.toLowerCase()] ?? [];
};

const addNameForAddress = (address: string, name: string, expiryDate = 0) => {
  const key = address.toLowerCase();
  const normalized = name.toLowerCase();

  setStore((previous) => {
    const existing = previous[key] ?? [];

    if (existing.some(owned => owned.name === normalized)) return previous;

    return { ...previous, [key]: [{ expiryDate, name: normalized }, ...existing] };
  });
};

const setNamesForAddress = (address: string, names: OwnedName[]) => {
  const key = address.toLowerCase();
  const normalized = names.map(owned => ({ ...owned, name: owned.name.toLowerCase() }));

  setStore(previous => ({ ...previous, [key]: normalized }));
};

const removeNameForAddress = (address: string, name: string) => {
  const key = address.toLowerCase();
  const normalized = name.toLowerCase();

  setStore((previous) => {
    const filtered = (previous[key] ?? []).filter(owned => owned.name !== normalized);

    if (filtered.length === 0) {
      return Object.fromEntries(Object.entries(previous).filter(([storedKey]) => storedKey !== key));
    }

    return { ...previous, [key]: filtered };
  });
};

export const useOwnedNames = () => ({
  addNameForAddress,
  getNamesForAddress,
  removeNameForAddress,
  setNamesForAddress,
});
