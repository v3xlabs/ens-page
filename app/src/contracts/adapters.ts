import type { Abi } from "viem";

export const poolAdapterAbi = [
  {
    inputs: [],
    name: "adapterType",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "pure",
    type: "function",
  },
] as const satisfies Abi;

export const streamAdapterAbi = [
  {
    inputs: [
      { internalType: "address", name: "pool", type: "address" },
      { internalType: "uint64", name: "durationSeconds", type: "uint64" },
    ],
    name: "createEthStream",
    outputs: [{ internalType: "uint256", name: "streamId", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "pool", type: "address" },
      { internalType: "address", name: "token", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "uint64", name: "durationSeconds", type: "uint64" },
    ],
    name: "createTokenStream",
    outputs: [{ internalType: "uint256", name: "streamId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "streamId", type: "uint256" }],
    name: "claim",
    outputs: [{ internalType: "uint256", name: "amount", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "streamId", type: "uint256" }],
    name: "cancel",
    outputs: [{ internalType: "uint256", name: "refund", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "streamId", type: "uint256" }],
    name: "accruedOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "pool", type: "address" }],
    name: "getPoolStreams",
    outputs: [
      { internalType: "uint256[]", name: "streamIds", type: "uint256[]" },
      {
        components: [
          { internalType: "address", name: "payer", type: "address" },
          { internalType: "address", name: "pool", type: "address" },
          { internalType: "address", name: "token", type: "address" },
          { internalType: "uint64", name: "startTime", type: "uint64" },
          { internalType: "uint64", name: "stopTime", type: "uint64" },
          { internalType: "uint256", name: "totalAmount", type: "uint256" },
          { internalType: "uint256", name: "claimed", type: "uint256" },
        ],
        internalType: "struct StreamAdapter.Stream[]",
        name: "result",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const satisfies Abi;

export const erc4626ProbeAbi = [
  {
    inputs: [],
    name: "asset",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const satisfies Abi;

export const erc20Abi = [
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "value", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "value", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const satisfies Abi;
