import { useQueryClient } from "@tanstack/solid-query";
import { useChainId, useClient, useReadContract, useWriteContract } from "@wagmi/solid";
import { type Accessor, createMemo } from "solid-js";
import { type Address, encodeFunctionData, type Hex, parseEventLogs } from "viem";
import { waitForTransactionReceipt } from "viem/actions";

import { renewalPoolFactoryAddress } from "../config";
import { renewalPoolAbi, renewalPoolFactoryAbi } from "../contracts/renewal-pool";
import type { TransactionRequest } from "./useTransaction";

export const useRenewalPoolFactory = () => {
  const queryClient = useQueryClient();
  const chainId = useChainId();
  const client = useClient(() => ({ chainId: chainId() }));
  const pools = useReadContract(() => ({
    abi: renewalPoolFactoryAbi,
    address: renewalPoolFactoryAddress,
    functionName: "getPools",
    query: { enabled: renewalPoolFactoryAddress !== undefined, refetchInterval: 10_000 },
  }));

  const prepareCreatePool = (poolOwner: Address): TransactionRequest => {
    if (!renewalPoolFactoryAddress) throw new Error("Renewal pool factory is not configured.");

    return {
      data: encodeFunctionData({ abi: renewalPoolFactoryAbi, args: [poolOwner], functionName: "createPool" }),
      to: renewalPoolFactoryAddress,
    };
  };

  const resolveCreatedPool = async (hash: Hex): Promise<Address> => {
    const publicClient = client();

    if (!publicClient) throw new Error("Network client is not available.");

    const receipt = await waitForTransactionReceipt(publicClient, { hash });
    const poolCreated = parseEventLogs({
      abi: renewalPoolFactoryAbi,
      eventName: "PoolCreated",
      logs: receipt.logs,
      strict: true,
    }).at(0);

    if (!poolCreated?.args.pool) throw new Error("Pool creation did not emit a pool address.");

    await queryClient.invalidateQueries({ queryKey: ["readContract"] });

    return poolCreated.args.pool;
  };

  return {
    factoryAddress: renewalPoolFactoryAddress,
    isConfigured: renewalPoolFactoryAddress !== undefined,
    pools,
    prepareCreatePool,
    resolveCreatedPool,
  };
};

export const useRenewalPool = (poolAddress: Accessor<Address | undefined>) => {
  const enabled = createMemo(() => poolAddress() !== undefined);
  const removeLabelMutation = useWriteContract();

  const requirePoolAddress = (): Address => {
    const address = poolAddress();

    if (!address) throw new Error("Pool address is not available.");

    return address;
  };

  const removeLabel = async (label: string) => removeLabelMutation.mutateAsync({
    abi: renewalPoolAbi,
    address: requirePoolAddress(),
    args: [label],
    functionName: "removeLabel",
  });

  const prepareLabelUpdate = (additions: string[], removals: string[]): TransactionRequest => ({
    data: encodeFunctionData({
      abi: renewalPoolAbi,
      args: [additions, removals],
      functionName: "updateLabels",
    }),
    to: requirePoolAddress(),
  });

  const prepareConfigurePool = (
    durationSeconds: bigint,
    thresholdSeconds: bigint,
    gasPriceCapWei: bigint,
    rewardCapWei: bigint,
    premiumWei: bigint,
  ): TransactionRequest => ({
    data: encodeFunctionData({
      abi: renewalPoolAbi,
      args: [durationSeconds, thresholdSeconds, gasPriceCapWei, rewardCapWei, premiumWei],
      functionName: "configurePool",
    }),
    to: requirePoolAddress(),
  });

  const prepareWithdrawEth = (recipient: Address, amountWei: bigint): TransactionRequest => ({
    data: encodeFunctionData({
      abi: renewalPoolAbi,
      args: [recipient, amountWei],
      functionName: "withdrawETH",
    }),
    to: requirePoolAddress(),
  });

  const gasPriceCap = useReadContract(() => ({
    abi: renewalPoolAbi,
    address: poolAddress(),
    functionName: "gasPriceCap",
    query: { enabled: enabled() },
  }));
  const rewardCap = useReadContract(() => ({
    abi: renewalPoolAbi,
    address: poolAddress(),
    functionName: "rewardCap",
    query: { enabled: enabled() },
  }));
  const premium = useReadContract(() => ({
    abi: renewalPoolAbi,
    address: poolAddress(),
    functionName: "premium",
    query: { enabled: enabled() },
  }));
  const renewalDuration = useReadContract(() => ({
    abi: renewalPoolAbi,
    address: poolAddress(),
    functionName: "renewalDuration",
    query: { enabled: enabled() },
  }));
  const renewalThreshold = useReadContract(() => ({
    abi: renewalPoolAbi,
    address: poolAddress(),
    functionName: "renewalThreshold",
    query: { enabled: enabled() },
  }));
  const owner = useReadContract(() => ({
    abi: renewalPoolAbi,
    address: poolAddress(),
    functionName: "owner",
    query: { enabled: enabled() },
  }));
  const labels = useReadContract(() => ({
    abi: renewalPoolAbi,
    address: poolAddress(),
    functionName: "getLabels",
    query: { enabled: enabled() },
  }));

  return {
    gasPriceCap,
    labels,
    owner,
    premium,
    prepareConfigurePool,
    prepareLabelUpdate,
    prepareWithdrawEth,
    renewalDuration,
    renewalThreshold,
    removeLabel,
    removeLabelMutation,
    rewardCap,
  };
};
