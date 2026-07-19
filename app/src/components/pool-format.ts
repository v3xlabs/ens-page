import type { PoolDeposit } from "../hooks/usePools";
import type { TransactionSummaryRow } from "./transaction-modal";

export const copyAddress = (address: string | undefined) => {
  if (address) void navigator.clipboard.writeText(address);
};

export const buildConfigSummary = (input: {
  durationDays: string;
  gasCeilingGwei: string;
  poolDisplay: string;
  premiumEth: string;
  renewalWindowDays: string;
}): TransactionSummaryRow[] => [
  { label: "Action", value: "Update pool configuration" },
  { label: "Pool", value: input.poolDisplay },
  { label: "Renewal duration", value: `${input.durationDays} days` },
  { label: "Renewal window", value: `${input.renewalWindowDays} days before expiry` },
  { label: "Gas ceiling", value: `${input.gasCeilingGwei} gwei` },
  { label: "Relayer premium", value: `${input.premiumEth} ETH` },
];

export const buildFundingSummary = (input: {
  action: "deposit" | "withdraw";
  amountEth: string;
  poolDisplay: string;
  recipient: string | undefined;
}): TransactionSummaryRow[] => [
  { label: "Action", value: input.action === "deposit" ? "Fund pool with ETH" : "Withdraw ETH from pool" },
  { label: "Pool", value: input.poolDisplay },
  { label: "Amount", value: input.amountEth ? `${input.amountEth} ETH` : "—" },
  ...(input.action === "withdraw" && input.recipient
    ? [{ label: "Recipient", value: input.recipient }]
    : []),
];

export const formatExpiryDate = (expirySeconds: number) => {
  if (expirySeconds === 0) return "unknown expiry";

  return new Date(expirySeconds * 1000).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
};

export const formatDepositDate = (atMs: number) =>
  new Date(atMs).toLocaleDateString("en-US", { day: "numeric", month: "short" });

export const depositMethodStyle: Record<PoolDeposit["method"], { iconChar: string; iconClass: string; verb: string; }> = {
  direct: { iconChar: "⤓", iconClass: "bg-blue-surface text-blue-primary", verb: "topped up" },
  stream: { iconChar: "⇄", iconClass: "bg-yellow-surface text-yellow-active", verb: "streamed" },
  swap: {
    iconChar: "⇆",
    iconClass: "bg-[#ffe4f0] text-[#c9256e] dark:bg-[#3d2231] dark:text-[#ff7ab2]",
    verb: "topped up via swap",
  },
};
