import { useChainId, useClient } from "@wagmi/solid";
import { createSignal, Show } from "solid-js";
import { getAddress, isAddress } from "viem";
import { readContract } from "viem/actions";

import { erc20Abi, erc4626ProbeAbi } from "../contracts/adapters";
import { useTrackedTokens } from "../hooks/useTrackedTokens";

/** Tracks an arbitrary ERC20 by address; metadata is probed on-chain and
 * ERC4626 vaults are detected through their `asset()` view. */
export const PoolTokenTracker = () => {
  const chainId = useChainId();
  const client = useClient(() => ({ chainId: chainId() }));
  const { addToken } = useTrackedTokens();
  const [input, setInput] = createSignal("");
  const [error, setError] = createSignal("");

  const handleAdd = async () => {
    setError("");

    const raw = input().trim();
    const publicClient = client();

    if (!isAddress(raw)) {
      setError("That is not a valid address.");

      return;
    }

    if (!publicClient) return;

    const address = getAddress(raw);

    try {
      const decimals = await readContract(publicClient, { abi: erc20Abi, address, functionName: "decimals" });
      const symbol = await readContract(publicClient, { abi: erc20Abi, address, functionName: "symbol" })
        .catch(() => `${address.slice(0, 6)}…${address.slice(-4)}`);
      const vaultAsset = await readContract(publicClient, { abi: erc4626ProbeAbi, address, functionName: "asset" })
        .catch(() => {});

      addToken({ address, decimals: Number(decimals), isVault: vaultAsset !== undefined, symbol });
      setInput("");
    }
    catch {
      setError("Could not read token metadata — is this an ERC20?");
    }
  };

  return (
    <>
      <div class="mt-2 flex flex-wrap items-center gap-2">
        <input
          class="min-w-52 flex-1 rounded-button border border-border bg-background-secondary px-2 py-1.5 text-xs font-bold"
          data-testid="add-token-input"
          onInput={event => setInput(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void handleAdd();
          }}
          placeholder="Track any ERC20 — paste its address"
          type="text"
          value={input()}
        />
        <button
          class="icon-button small px-2 text-xs font-bold"
          data-testid="add-token-submit"
          onClick={() => void handleAdd()}
          type="button"
        >
          Add token
        </button>
      </div>
      <Show when={error()}>
        <p class="mt-1 text-xs font-bold text-red-primary">{error()}</p>
      </Show>
    </>
  );
};
