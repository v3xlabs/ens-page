import type { Abi } from "viem";

export const renewalPoolFactoryAbi = [
  {
    inputs: [],
    name: "getPools",
    outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getAdapters",
    outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "adapter", type: "address" }],
    name: "isAdapterAllowed",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "poolOwner", type: "address" }],
    name: "createPool",
    outputs: [{ internalType: "contract RenewalPool", name: "pool", type: "address" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "pool", type: "address" },
      { indexed: true, internalType: "address", name: "poolOwner", type: "address" },
    ],
    name: "PoolCreated",
    type: "event",
  },
] as const satisfies Abi;

const routeStepComponents = [
  { internalType: "contract IPoolAdapter", name: "adapter", type: "address" },
  { internalType: "bytes", name: "data", type: "bytes" },
] as const;

export const renewalPoolAbi = [
  {
    inputs: [
      { internalType: "string[]", name: "additions", type: "string[]" },
      { internalType: "string[]", name: "removals", type: "string[]" },
    ],
    name: "updateLabels",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "adapter", type: "address" }],
    name: "isAdapterEnabled",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "adapter", type: "address" },
          { internalType: "bool", name: "enabled", type: "bool" },
        ],
        internalType: "struct RenewalPool.AdapterSetting[]",
        name: "adapterSettings",
        type: "tuple[]",
      },
      {
        components: [
          { internalType: "address", name: "token", type: "address" },
          { components: routeStepComponents, internalType: "struct RenewalPool.RouteStep[]", name: "steps", type: "tuple[]" },
        ],
        internalType: "struct RenewalPool.TokenRoute[]",
        name: "routes",
        type: "tuple[]",
      },
    ],
    name: "configureAdapters",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "token", type: "address" }],
    name: "getTokenRoute",
    outputs: [
      { components: routeStepComponents, internalType: "struct RenewalPool.RouteStep[]", name: "", type: "tuple[]" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "token", type: "address" },
      { internalType: "uint256", name: "amountIn", type: "uint256" },
    ],
    name: "executeRoute",
    outputs: [{ internalType: "uint256", name: "ethOut", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "renewalDuration",
    outputs: [{ internalType: "uint64", name: "", type: "uint64" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "renewalThreshold",
    outputs: [{ internalType: "uint64", name: "", type: "uint64" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint64", name: "duration", type: "uint64" },
      { internalType: "uint64", name: "threshold", type: "uint64" },
      { internalType: "uint256", name: "gasPriceCap_", type: "uint256" },
      { internalType: "uint256", name: "rewardCap_", type: "uint256" },
      { internalType: "uint256", name: "premium_", type: "uint256" },
    ],
    name: "configurePool",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getLabels",
    outputs: [{ internalType: "string[]", name: "", type: "string[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "label", type: "string" }],
    name: "labelConfig",
    outputs: [
      { internalType: "uint64", name: "duration", type: "uint64" },
      { internalType: "uint64", name: "threshold", type: "uint64" },
      { internalType: "bool", name: "configured", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "label", type: "string" }],
    name: "removeLabel",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "gasPriceCap",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "rewardCap",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "premium",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string", name: "label", type: "string" },
      { internalType: "uint64", name: "duration", type: "uint64" },
      { internalType: "uint64", name: "threshold", type: "uint64" },
    ],
    name: "configureLabel",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "gasPriceCap_", type: "uint256" },
      { internalType: "uint256", name: "rewardCap_", type: "uint256" },
      { internalType: "uint256", name: "premium_", type: "uint256" },
    ],
    name: "configureReward",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address payable", name: "recipient", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "withdrawETH",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const satisfies Abi;
