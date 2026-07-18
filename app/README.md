# app.ens.page

A frontend-only Ethereum Name Service manager built with SolidJS, TanStack Router & Query, Kobalte, wagmi, and viem.

## Features

- Search any ENS name (search bar or Cmd+K) and inspect its profile, text records, multi-chain addresses, resolver, and registry.
- Edit text records for names you own — changes are batched into a single resolver `multicall` transaction.
- Track owned names (visited or fetched from the ENS subgraph) with expiry badges, and bulk-renew them.
- EIP-5792 (`wallet_getCapabilities`) batch-transaction detection.

## Development

```bash
pnpm install
pnpm dev      # start dev server on http://localhost:5173
pnpm lint     # eslint
pnpm build    # typecheck + production build
```

## Structure

- `src/routes/` — file-path route definitions and the generated route tree
- `src/pages/` — page content used by the route definitions
- `src/components/` — UI components (navbar, search, dialogs, renewal cart)
- `src/hooks/` — TanStack Query wrappers around viem ENS actions, plus persisted client-side stores
- `src/utils/` — pure helpers (normalization, record definitions, calldata preparation, storage)
- `src/config.ts` — wagmi chain and transport configuration

See `docs/transaction-ux.md` for the transaction flow design.
