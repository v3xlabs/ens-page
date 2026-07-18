import { createRootRoute, Outlet } from "@tanstack/solid-router";
import { useChainId } from "@wagmi/solid";
import { ErrorBoundary, Show, Suspense } from "solid-js";

import { CmdK } from "../components/cmd-k";
import { Navbar } from "../components/nav/navbar";

const NetworkErrorCard = (properties: { chainId: number; onRetry: () => void; }) => (
  <div class="card mx-auto w-full max-w-2xl p-8 text-center" data-chain-id={properties.chainId}>
    <h2 class="text-xl font-bold">Can't reach the network</h2>
    <p class="mt-2 text-text-secondary">
      The RPC for this chain isn't responding. Switch networks above, or retry once it's back.
    </p>
    <button class="button subtle mt-5" onClick={() => properties.onRetry()} type="button">
      Retry
    </button>
  </div>
);

const RootLayout = () => {
  const chainId = useChainId();

  return (
    <main class="min-h-screen bg-background-secondary text-text-primary">
      <Navbar />
      <CmdK />
      <div class="px-4 pt-6 sm:px-6 sm:pt-8">
        <Show when={chainId()} keyed>
          {activeChainId => (
            <ErrorBoundary fallback={(_error, reset) => <NetworkErrorCard chainId={activeChainId} onRetry={reset} />}>
              <Suspense fallback={<div class="card mx-auto w-full max-w-2xl p-8 text-center text-text-secondary">Loading…</div>}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          )}
        </Show>
      </div>
    </main>
  );
};

export const Route = createRootRoute({ component: RootLayout });
