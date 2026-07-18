import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { useChainId, useChains, useSwitchChain } from "@wagmi/solid";
import { TbOutlineChevronDown } from "solid-icons/tb";
import { createMemo, For, Suspense } from "solid-js";

import { anvilChain, isAnvilEnabled } from "../config";
import { useChainHealth } from "../hooks/useChainHealth";

// Reads the health probe on its own, behind its own boundary, so a pending or
// failing probe can never suspend the navbar.
const HealthDot = () => {
  const health = useChainHealth();

  return (
    <span
      classList={{
        "!bg-red-primary": health.status === "error",
        "chain-dot": true,
      }}
      title={health.status === "error" ? "RPC unreachable" : undefined}
    />
  );
};

export const ChainSelector = () => {
  const chainId = useChainId();
  const chains = useChains();
  const switchChain = useSwitchChain();
  const currentChain = createMemo(() => chains().find(chain => chain["id"] === chainId()));

  const visibleChains = createMemo(
    () => chains().filter(chain => chain["id"] !== anvilChain["id"] || isAnvilEnabled),
  );

  const switchToChain = async (nextChainId: number) => {
    if (nextChainId === chainId()) return;

    await switchChain.mutateAsync({ chainId: nextChainId });
  };

  return (
    <DropdownMenu placement="bottom-end" gutter={8}>
      <DropdownMenu.Trigger class="chain-trigger" type="button">
        <Suspense fallback={<span class="chain-dot !bg-background-disabled" />}>
          <HealthDot />
        </Suspense>
        <span class="max-w-24 truncate font-bold">{currentChain()?.name ?? "Mainnet"}</span>
        <TbOutlineChevronDown size={16} aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content class="dropdown-content">
          <For each={visibleChains()}>
            {chain => (
              <DropdownMenu.Item class="dropdown-item" onSelect={() => void switchToChain(chain["id"])}>
                {chain.name}
              </DropdownMenu.Item>
            )}
          </For>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu>
  );
};
