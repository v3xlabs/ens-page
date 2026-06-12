import type { Address, Client } from "viem";
import { readContract } from "viem/actions";
import { encodeFunctionData } from "viem/utils";

export const ULTRABULK_ADDRESS: Address = "0x7Ff29Bd08AF26495EeB96cb5D80f1813C0410917";

// UltraBulk forwards each renewal to the pre-2023 controller, which is still an
// authorized controller on the .eth BaseRegistrar and can renew any .eth name.
export const OLD_ETH_REGISTRAR_CONTROLLER_ADDRESS: Address = "0x283Af0B28c62C092C9727F1Ee09c02CA627EB7F5";

const RENT_PRICE_ABI = [
  {
    inputs: [
      { internalType: "string", name: "name", type: "string" },
      { internalType: "uint256", name: "duration", type: "uint256" },
    ],
    name: "rentPrice",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const RENEW_ALL_ABI = [
  {
    inputs: [
      { internalType: "string[]", name: "names", type: "string[]" },
      { internalType: "uint256", name: "duration", type: "uint256" },
      { internalType: "uint256", name: "price", type: "uint256" },
    ],
    name: "renewAll",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
] as const;

export const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;

export const labelFor = (name: string) => name.replace(/\.eth$/, "");

export type RenewalQuote = {
  pricePerNameWei: bigint;
  totalWei: bigint;
};

// UltraBulk calls controller.renew{value: price} per name and requires
// msg.value to be STRICTLY greater than price * names.length, hence the +1 wei.
// Any excess beyond rentPrice is kept by the contract, so price stays exact.
export const fetchRenewalQuote = async (
  client: Client,
  names: string[],
  durationSeconds: number,
): Promise<RenewalQuote> => {
  const prices = await Promise.all(names.map(name => readContract(client, {
    abi: RENT_PRICE_ABI,
    address: OLD_ETH_REGISTRAR_CONTROLLER_ADDRESS,
    args: [labelFor(name), BigInt(durationSeconds)],
    functionName: "rentPrice",
  })));

  let pricePerNameWei = 0n;

  for (const price of prices) {
    if (price > pricePerNameWei) pricePerNameWei = price;
  }

  return {
    pricePerNameWei,
    totalWei: pricePerNameWei * BigInt(names.length) + 1n,
  };
};

// The controller renews by label, so full names must be stripped of ".eth",
// and value is derived from the encoded price so the two can never disagree.
export const prepareRenewAll = (
  names: string[],
  durationSeconds: number,
  pricePerNameWei: bigint,
) => ({
  data: encodeFunctionData({
    abi: RENEW_ALL_ABI,
    args: [names.map(name => labelFor(name)), BigInt(durationSeconds), pricePerNameWei],
    functionName: "renewAll",
  }),
  to: ULTRABULK_ADDRESS,
  value: pricePerNameWei * BigInt(names.length) + 1n,
});
