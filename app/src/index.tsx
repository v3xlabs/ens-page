/* @refresh reload */
import "./index.css";

import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { WagmiProvider } from "@wagmi/solid";
import { render } from "solid-js/web";

import { App } from "./App.tsx";
import { wagmiConfig } from "./config.ts";

const root = document.querySelector("#root");

if (!root) throw new Error("Missing #root element");

// A dead RPC fails identically on every attempt — retrying only delays the UI
// settling into its fallbacks. Real (non-transport) errors get one retry.
const isTransportError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;

  if (
    error.name === "HttpRequestError"
    || error.name === "TimeoutError"
    || error.message.includes("fetch failed")
    || error.message.includes("Failed to fetch")
  ) return true;

  return isTransportError(error.cause);
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => !isTransportError(error) && failureCount < 1,
    },
  },
});

render(
  () => (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <App />
      </WagmiProvider>
    </QueryClientProvider>
  ),
  root,
);
