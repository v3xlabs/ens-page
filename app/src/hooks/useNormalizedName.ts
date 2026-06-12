import { type Accessor, createMemo } from "solid-js";

import { normalizeName } from "../utils/ens";

export const useNormalizedName = (name: Accessor<string | undefined>) =>
  createMemo(() => normalizeName(name() ?? ""));
