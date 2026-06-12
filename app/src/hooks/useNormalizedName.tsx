import { type Accessor, createMemo } from "solid-js";
import { normalize } from "viem/ens";

export const useNormalizedName = (name: Accessor<string | undefined>) => createMemo(() => {
  try {
    const value = name()?.trim();

    return value ? normalize(value) : "";
  }
  catch {
    return "";
  }
});
