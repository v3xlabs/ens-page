import { createStoredSignal } from "../utils/storage";
import { settings } from "./useSettings";

const STORAGE_KEY = "ens-manager-search-cache";

const parseCache = (raw: unknown): string[] | undefined => {
  if (!Array.isArray(raw)) return;

  return raw.filter((entry): entry is string => typeof entry === "string");
};

const [cache, setCache] = createStoredSignal<string[]>({
  defaultValue: [],
  parse: parseCache,
  shouldPersist: () => settings().nameSearchRetention,
  storageKey: STORAGE_KEY,
});

const addToCache = (name: string) => {
  setCache(previous => [name, ...previous.filter(cached => cached !== name)]);
};

const clearCache = () => {
  setCache(() => []);
  localStorage.removeItem(STORAGE_KEY);
};

const cacheSize = () => cache().length;

export const useSearchCache = () => ({ addToCache, cache, cacheSize, clearCache });
