import { isAddress } from "viem";

import { createStoredSignal } from "../utils/storage";
import { KNOWN_TOKENS, type TrackedToken } from "../utils/tokens";

const isTrackedToken = (raw: unknown): raw is TrackedToken => {
  if (typeof raw !== "object" || raw === null) return false;

  const candidate = raw as Partial<TrackedToken>;

  return typeof candidate.address === "string"
    && isAddress(candidate.address)
    && typeof candidate.decimals === "number"
    && typeof candidate.isVault === "boolean"
    && typeof candidate.symbol === "string";
};

const parseTokens = (raw: unknown): TrackedToken[] | undefined => {
  if (!Array.isArray(raw)) return;

  return raw.filter(isTrackedToken);
};

const [customTokens, setCustomTokens] = createStoredSignal<TrackedToken[]>({
  defaultValue: [],
  parse: parseTokens,
  storageKey: "ens-manager-custom-tokens",
});

const isKnown = (address: string) => KNOWN_TOKENS.some(token => token.address.toLowerCase() === address.toLowerCase());

const trackedTokens = (): TrackedToken[] => [
  ...KNOWN_TOKENS,
  ...customTokens().filter(token => !isKnown(token.address)),
];

const findTrackedToken = (address: string): TrackedToken | undefined =>
  trackedTokens().find(token => token.address.toLowerCase() === address.toLowerCase());

const addToken = (token: TrackedToken) => {
  if (isKnown(token.address)) return;

  setCustomTokens(previous => [
    ...previous.filter(existing => existing.address.toLowerCase() !== token.address.toLowerCase()),
    token,
  ]);
};

const removeToken = (address: string) => {
  setCustomTokens(previous => previous.filter(token => token.address.toLowerCase() !== address.toLowerCase()));
};

export const useTrackedTokens = () => ({
  addToken,
  customTokens,
  findTrackedToken,
  removeToken,
  trackedTokens,
});
