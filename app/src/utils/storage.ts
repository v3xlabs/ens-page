import { createSignal } from "solid-js";

type StoredSignalOptions<Value> = {
  defaultValue: Value;
  parse: (raw: unknown) => Value | undefined;
  shouldPersist?: () => boolean;
  storageKey: string;
};

export const createStoredSignal = <Value>(options: StoredSignalOptions<Value>) => {
  const load = (): Value => {
    try {
      const stored = localStorage.getItem(options.storageKey);

      if (!stored) return options.defaultValue;

      return options.parse(JSON.parse(stored)) ?? options.defaultValue;
    }
    catch {
      return options.defaultValue;
    }
  };

  const [value, setSignal] = createSignal<Value>(load());

  const setValue = (update: (previous: Value) => Value) => {
    const next = setSignal(previous => update(previous));

    if (options.shouldPersist && !options.shouldPersist()) {
      localStorage.removeItem(options.storageKey);
    }
    else {
      localStorage.setItem(options.storageKey, JSON.stringify(next));
    }

    return next;
  };

  return [value, setValue] as const;
};
