import { useConnection } from "@wagmi/solid";
import { Show } from "solid-js";

import { shortenAddress } from "../config";

export const NamesPage = () => {
  const connection = useConnection();

  return (
    <section class="card p-5 sm:p-6">
      <span class="tag blue">My names</span>
      <h2 class="mt-4 text-3xl font-bold tracking-tight">Owned names</h2>
      <p class="mt-3 max-w-2xl text-text-secondary">
        This page is ready for the owned-name index. Next step is reading names from frontend-safe sources and linking each one to its `/$name` route.
      </p>
      <div class="mt-6 rounded-card border border-border bg-background-secondary p-4 text-text-secondary">
        <Show when={connection().address} fallback="Connect a wallet to view names.">
          {address => `Connected wallet: ${shortenAddress(address())}`}
        </Show>
      </div>
    </section>
  );
};
