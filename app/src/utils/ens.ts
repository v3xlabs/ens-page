import type { Address, Hex } from "viem";
import { namehash, normalize } from "viem/ens";
import { encodeFunctionData } from "viem/utils";

// Same singleton on every chain ENS is deployed to, including Sepolia.
export const ENS_REGISTRY_ADDRESS: Address = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";

export const BASE_REGISTRAR_ADDRESS: Address = "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85";

// The name-donation public good: names it holds are up for adoption.
export const ENSFAIRY_ADDRESS: Address = "0x481f50a5BdcCC0bc4322C4dca04301433dED50f0";

export const ENSFAIRY_NAME = "ensfairy.eth";

export const normalizeName = (name: string) => {
  try {
    return normalize(name.trim());
  }
  catch {
    return "";
  }
};

export const shortenAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

export const resolveIpfsUri = (uri: string) =>
  (uri.startsWith("ipfs://") ? uri.replace("ipfs://", "https://ipfs.io/ipfs/") : uri);

const RESOLVER_ABI = [
  {
    inputs: [
      { internalType: "bytes32", name: "node", type: "bytes32" },
      { internalType: "string", name: "key", type: "string" },
      { internalType: "string", name: "value", type: "string" },
    ],
    name: "setText",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes[]", name: "data", type: "bytes[]" }],
    name: "multicall",
    outputs: [{ internalType: "bytes[]", name: "results", type: "bytes[]" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export type TextRecordChange = {
  key: string;
  value: string;
};

export const prepareSetTexts = (name: string, resolver: Address, changes: TextRecordChange[]) => {
  const node = namehash(name);

  const calls = changes.map(change => encodeFunctionData({
    abi: RESOLVER_ABI,
    args: [node, change.key, change.value],
    functionName: "setText",
  }));

  const data: Hex = calls.length === 1
    ? calls[0]
    : encodeFunctionData({ abi: RESOLVER_ABI, args: [calls], functionName: "multicall" });

  return { data, to: resolver };
};
