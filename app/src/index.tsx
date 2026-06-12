/* @refresh reload */
import "./index.css";

import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { WagmiProvider } from "@wagmi/solid";
import { render } from "solid-js/web";

import { App } from "./App.tsx";
import { wagmiConfig } from "./config.ts";

const root = document.querySelector("#root");

if (!root) throw new Error("Missing #root element");

const queryClient = new QueryClient();

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
