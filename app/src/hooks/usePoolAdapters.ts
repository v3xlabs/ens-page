import { useChainId, useClient } from "@wagmi/solid";
import { useQuery } from "@wagmi/solid/query";
import type { Accessor } from "solid-js";
import { type Address, decodeAbiParameters, encodeAbiParameters, encodeFunctionData, type Hex } from "viem";
import { readContract } from "viem/actions";

import { renewalPoolFactoryAddress } from "../config";
import { erc20Abi, poolAdapterAbi, streamAdapterAbi } from "../contracts/adapters";
import { renewalPoolAbi, renewalPoolFactoryAbi } from "../contracts/renewal-pool";
import { WETH_ADDRESS } from "../utils/tokens";
import type { TransactionRequest } from "./useTransaction";

export type AdapterKind = "stream" | "swap" | "unknown" | "yield";

export type PoolAdapterInfo = {
  address: Address;
  isAllowed: boolean;
  isEnabled: boolean;
  kind: AdapterKind;
};

export type RouteStep = {
  adapter: Address;
  data: Hex;
};

export type PoolStream = {
  accrued: bigint;
  claimed: bigint;
  payer: Address;
  startTime: number;
  stopTime: number;
  streamId: bigint;
  token: Address;
  totalAmount: bigint;
};

const isAdapterKind = (value: string): value is Exclude<AdapterKind, "unknown"> =>
  value === "stream" || value === "swap" || value === "yield";

const swapConfigComponents = [
  {
    components: [
      { name: "tokenOut", type: "address" },
      { name: "fee", type: "uint24" },
      { name: "minOutPerWad", type: "uint256" },
      { name: "oracleSlippageBps", type: "uint16" },
      { name: "unwrapNative", type: "bool" },
    ],
    name: "config",
    type: "tuple",
  },
] as const;

export type SwapStepConfig = {
  feeTier: number;
  minOutPerWad: bigint;
  oracleSlippageBps: number;
};

// Swap steps always target WETH and unwrap, so every route ends in ETH.
export const encodeSwapStepData = (config: SwapStepConfig): Hex => encodeAbiParameters(swapConfigComponents, [{
  fee: config.feeTier,
  minOutPerWad: config.minOutPerWad,
  oracleSlippageBps: config.oracleSlippageBps,
  tokenOut: WETH_ADDRESS,
  unwrapNative: true,
}]);

export const decodeSwapStepData = (data: Hex): SwapStepConfig | undefined => {
  try {
    const [config] = decodeAbiParameters(swapConfigComponents, data);

    return { feeTier: config.fee, minOutPerWad: config.minOutPerWad, oracleSlippageBps: config.oracleSlippageBps };
  }
  catch {
    return undefined;
  }
};

/** Factory adapter list with per-pool enablement status. */
export const usePoolAdapters = (poolAddress: Accessor<Address | undefined>) => {
  const chainId = useChainId();
  const client = useClient(() => ({ chainId: chainId() }));

  return useQuery<PoolAdapterInfo[], Error, PoolAdapterInfo[], readonly ["poolAdapters", number, Address | undefined]>(() => ({
    enabled: renewalPoolFactoryAddress !== undefined,
    queryFn: async () => {
      const publicClient = client();
      const pool = poolAddress();
      const factoryAddress = renewalPoolFactoryAddress;

      if (!publicClient || !factoryAddress) return [];

      const addresses = await readContract(publicClient, {
        abi: renewalPoolFactoryAbi,
        address: factoryAddress,
        functionName: "getAdapters",
      });

      return Promise.all(addresses.map(async (address): Promise<PoolAdapterInfo> => {
        const [kind, isAllowed, isEnabled] = await Promise.all([
          readContract(publicClient, { abi: poolAdapterAbi, address, functionName: "adapterType" })
            .catch(() => "unknown"),
          readContract(publicClient, {
            abi: renewalPoolFactoryAbi,
            address: factoryAddress,
            args: [address],
            functionName: "isAdapterAllowed",
          }),
          pool
            ? readContract(publicClient, { abi: renewalPoolAbi, address: pool, args: [address], functionName: "isAdapterEnabled" })
            : Promise.resolve(false),
        ]);

        return { address, isAllowed, isEnabled, kind: isAdapterKind(kind) ? kind : "unknown" };
      }));
    },
    queryKey: ["poolAdapters", chainId(), poolAddress()] as const,
  }));
};

/** Configured conversion routes for a set of tokens. */
export const useTokenRoutes = (poolAddress: Accessor<Address | undefined>, tokens: Accessor<Address[]>) => {
  const chainId = useChainId();
  const client = useClient(() => ({ chainId: chainId() }));

  return useQuery<Record<string, RouteStep[]>, Error, Record<string, RouteStep[]>, readonly ["tokenRoutes", number, Address | undefined, string]>(() => ({
    enabled: poolAddress() !== undefined,
    queryFn: async () => {
      const publicClient = client();
      const pool = poolAddress();

      if (!publicClient || !pool) return {};

      const entries = await Promise.all(tokens().map(async (token): Promise<[string, RouteStep[]]> => {
        const steps = await readContract(publicClient, {
          abi: renewalPoolAbi,
          address: pool,
          args: [token],
          functionName: "getTokenRoute",
        });

        return [token.toLowerCase(), steps.map(step => ({ adapter: step.adapter, data: step.data }))];
      }));

      return Object.fromEntries(entries);
    },
    queryKey: ["tokenRoutes", chainId(), poolAddress(), tokens().join(",")] as const,
  }));
};

/** Streams flowing into a pool, including live accrual. */
export const usePoolStreams = (
  streamAdapter: Accessor<Address | undefined>,
  poolAddress: Accessor<Address | undefined>,
) => {
  const chainId = useChainId();
  const client = useClient(() => ({ chainId: chainId() }));

  return useQuery<PoolStream[], Error, PoolStream[], readonly ["poolStreams", number, Address | undefined, Address | undefined]>(() => ({
    enabled: streamAdapter() !== undefined && poolAddress() !== undefined,
    queryFn: async () => {
      const publicClient = client();
      const adapter = streamAdapter();
      const pool = poolAddress();

      if (!publicClient || !adapter || !pool) return [];

      const [streamIds, streams] = await readContract(publicClient, {
        abi: streamAdapterAbi,
        address: adapter,
        args: [pool],
        functionName: "getPoolStreams",
      });

      return Promise.all(streamIds.map(async (streamId, index): Promise<PoolStream> => {
        const stream = streams[index];
        const accrued = await readContract(publicClient, {
          abi: streamAdapterAbi,
          address: adapter,
          args: [streamId],
          functionName: "accruedOf",
        });

        return {
          accrued,
          claimed: stream.claimed,
          payer: stream.payer,
          startTime: Number(stream.startTime),
          stopTime: Number(stream.stopTime),
          streamId,
          token: stream.token,
          totalAmount: stream.totalAmount,
        };
      }));
    },
    queryKey: ["poolStreams", chainId(), streamAdapter(), poolAddress()] as const,
    refetchInterval: 15_000,
  }));
};

export type AdapterSetting = {
  adapter: Address;
  enabled: boolean;
};

export type TokenRouteUpdate = {
  steps: RouteStep[];
  token: Address;
};

export const prepareConfigureAdapters = (
  pool: Address,
  settings: AdapterSetting[],
  routes: TokenRouteUpdate[],
): TransactionRequest => ({
  data: encodeFunctionData({ abi: renewalPoolAbi, args: [settings, routes], functionName: "configureAdapters" }),
  to: pool,
});

export const prepareExecuteRoute = (pool: Address, token: Address, amountIn: bigint): TransactionRequest => ({
  data: encodeFunctionData({ abi: renewalPoolAbi, args: [token, amountIn], functionName: "executeRoute" }),
  to: pool,
});

export const prepareErc20Transfer = (token: Address, recipient: Address, amount: bigint): TransactionRequest => ({
  data: encodeFunctionData({ abi: erc20Abi, args: [recipient, amount], functionName: "transfer" }),
  to: token,
});

export const prepareErc20Approve = (token: Address, spender: Address, amount: bigint): TransactionRequest => ({
  data: encodeFunctionData({ abi: erc20Abi, args: [spender, amount], functionName: "approve" }),
  to: token,
});

export const prepareCreateEthStream = (
  streamAdapter: Address,
  pool: Address,
  durationSeconds: bigint,
  amountWei: bigint,
): TransactionRequest => ({
  data: encodeFunctionData({ abi: streamAdapterAbi, args: [pool, durationSeconds], functionName: "createEthStream" }),
  to: streamAdapter,
  value: amountWei,
});

export const prepareCreateTokenStream = (
  streamAdapter: Address,
  pool: Address,
  token: Address,
  amount: bigint,
  durationSeconds: bigint,
): TransactionRequest => ({
  data: encodeFunctionData({
    abi: streamAdapterAbi,
    args: [pool, token, amount, durationSeconds],
    functionName: "createTokenStream",
  }),
  to: streamAdapter,
});

export const prepareClaimStream = (streamAdapter: Address, streamId: bigint): TransactionRequest => ({
  data: encodeFunctionData({ abi: streamAdapterAbi, args: [streamId], functionName: "claim" }),
  to: streamAdapter,
});
