import { Show } from "solid-js";
import type { Address } from "viem";

import { shortenAddress } from "../config";

type NameIdentityProperties = {
  address: Address;
  avatar?: string;
  name: string;
};

export const NameIdentity = (properties: NameIdentityProperties) => (
  <div class="flex items-center gap-3">
    <div class="grid size-12 place-items-center overflow-hidden rounded-full bg-blue-primary text-lg font-bold text-text-accent">
      <Show when={properties.avatar} fallback={properties.name.slice(0, 2).toUpperCase()}>
        {avatar => <img src={avatar()} alt="" class="size-full object-cover" />}
      </Show>
    </div>
    <div>
      <p class="font-bold">{properties.name}</p>
      <p class="text-sm text-text-secondary">{shortenAddress(properties.address)}</p>
    </div>
  </div>
);
