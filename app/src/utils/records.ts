import { toCoinType } from "viem";

export const defaultTextRecords = [
  { key: "avatar", label: "Avatar" },
  { key: "header", label: "Banner" },
  { key: "description", label: "Description" },
  { key: "url", label: "Website" },
  { key: "email", label: "Email" },
  { key: "notice", label: "Notice" },
  { key: "keywords", label: "Keywords" },
  { key: "com.twitter", label: "Twitter" },
  { key: "com.github", label: "GitHub" },
  { key: "com.discord", label: "Discord" },
  { key: "com.telegram", label: "Telegram" },
  { key: "com.reddit", label: "Reddit" },
  { key: "com.linkedin", label: "LinkedIn" },
  { key: "com.farcaster", label: "Farcaster" },
  { key: "com.bluesky", label: "Bluesky" },
  { key: "org.matrix", label: "Matrix" },
] as const;

export const defaultAddressRecords = [
  { coinType: 60n, key: "eth", label: "Ethereum" },
  { coinType: 0n, key: "btc", label: "Bitcoin" },
  { coinType: 501n, key: "sol", label: "Solana" },
  { coinType: toCoinType(8453), key: "base", label: "Base" },
  { coinType: toCoinType(10), key: "optimism", label: "OP Mainnet" },
  { coinType: toCoinType(42_161), key: "arbitrum", label: "Arbitrum One" },
  { coinType: toCoinType(137), key: "polygon", label: "Polygon" },
] as const;

export type DefaultAddressRecord = typeof defaultAddressRecords[number];
export type DefaultTextRecord = typeof defaultTextRecords[number];
