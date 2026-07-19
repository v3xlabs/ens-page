import type { Address } from "viem";
import { formatUnits, parseUnits } from "viem/utils";

export type TrackedToken = {
  address: Address;
  decimals: number;
  // ERC4626 vault shares route through redeem-then-swap; plain tokens swap directly.
  isVault: boolean;
  symbol: string;
};

// Mainnet addresses; the local anvil fork carries the same deployments.
export const WETH_ADDRESS: Address = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

export const KNOWN_TOKENS: readonly TrackedToken[] = [
  { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6, isVault: false, symbol: "USDC" },
  { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18, isVault: false, symbol: "DAI" },
];

export const findKnownToken = (address: string): TrackedToken | undefined =>
  KNOWN_TOKENS.find(token => token.address.toLowerCase() === address.toLowerCase());

export const tokenLabel = (address: string): string =>
  findKnownToken(address)?.symbol ?? `${address.slice(0, 6)}…${address.slice(-4)}`;

export const parseTokenAmount = (value: string, decimals: number): bigint | undefined => {
  try {
    const parsed = parseUnits(value, decimals);

    return parsed > 0n ? parsed : undefined;
  }
  catch {
    return undefined;
  }
};

export const formatTokenAmount = (value: bigint, decimals: number): string => {
  const formatted = Number(formatUnits(value, decimals));

  return formatted.toLocaleString("en-US", { maximumFractionDigits: 4 });
};
