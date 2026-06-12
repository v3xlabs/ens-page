import { normalize } from "viem/ens";

export const normalizeName = (name: string) => {
  try {
    return normalize(name.trim());
  }
  catch {
    return "";
  }
};
