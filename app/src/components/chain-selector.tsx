import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { useChainId, useChains, useSwitchChain } from "@wagmi/solid";
import { TbOutlineChevronDown } from "solid-icons/tb";
import { createMemo, For } from "solid-js";

export const ChainSelector = () => {
  const chainId = useChainId();
  const chains = useChains();
  const switchChain = useSwitchChain();
  const currentChain = createMemo(() => chains().find(chain => chain["id"] === chainId()));

  const switchToChain = async (nextChainId: number) => {
    if (nextChainId === chainId()) return;

    await switchChain.mutateAsync({ chainId: nextChainId });
  };

  return (
    <DropdownMenu placement="bottom-end" gutter={8}>
      <DropdownMenu.Trigger class="chain-trigger" type="button">
        <span class="chain-dot" />
        <span class="max-w-24 truncate font-bold">{currentChain()?.name ?? "Mainnet"}</span>
        <TbOutlineChevronDown size={16} aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content class="dropdown-content">
          <For each={chains()}>
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
