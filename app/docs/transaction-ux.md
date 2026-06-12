# Transaction UX Framework

## Overview

This document describes the transaction framework used throughout the ENS Manager app. Every user-initiated transaction follows a consistent flow with clear feedback at each step, driven by the `useTransaction` hook and visualized by the `TransactionModal` component.

## Transaction Flow Steps

Every transaction progresses through these stages:

### 1. Preview
- User sees a summary of what they're about to do
- Names being renewed, duration, and total cost are displayed
- The "Confirm" button is enabled but the user must explicitly click it
- At this point, no blockchain interaction has occurred

### 2. Simulate
- The transaction is simulated via `eth_call` against current chain state
- If simulation fails, the error is shown and the user can dismiss or retry
- If simulation succeeds, the flow proceeds automatically — no wallet prompt is shown for a transaction that would revert

### 3. Wait for Signature
- The wallet's signature prompt is shown to the user
- The UI shows a loading state indicating the wallet is waiting for approval
- If the user rejects, the error is caught and displayed

### 4. Confirm
- The signed transaction is submitted and the hash is captured immediately
- The hash is displayed with an Etherscan link
- The app waits for the transaction receipt while a progress bar fills

### 5. Success / Error
- On success: a green confirmation banner is shown alongside the tx hash
- On error: a red error banner is shown with the error message
- User clicks "Done" to close the modal; closing is blocked while a transaction is pending

## Architecture

### useTransaction Hook

A state machine plus orchestration. `TxState` is a discriminated union, so a hash only exists in states that have one, and an error message only exists in the error state:

```ts
type TxState =
  | { step: "idle" | "preview" | "simulating" | "waiting-for-signature" }
  | { hash: Hex; step: "confirming" | "success" }
  | { error: string; step: "error" };
```

```tsx
const transaction = useTransaction();

// Open the preview step (and the modal)
transaction.preview();

// simulate → sign → wait for receipt, walking the state machine internally.
// Resolves with the tx hash on success, or undefined after entering the error state.
const hash = await transaction.send({ data, to, value });

if (hash) {
  // success side effects: clear cart, invalidate queries, …
}

// Back to idle when the modal closes
transaction.reset();
```

`send` walks the state machine itself; callers only handle success side effects.

### TransactionModal Component

A dialog component that visualizes the transaction flow:

- Shows step indicators (Preview, Simulate, Sign, Confirm)
- Active step has a spinner animation; completed steps show a checkmark
- Error state shows a red alert with the error message
- Success state shows a green confirmation
- Transaction hash is displayed with an Etherscan link
- A progress bar derived from the current step fills as the flow advances
- Closing is prevented while a transaction is pending

Props:
- `isOpen` — controls dialog visibility
- `state` — the current `TxState` from `useTransaction`
- `title` — dialog title (e.g. "Renew Names")
- `onConfirm` — callback for the primary action button in the preview step
- `onClose` — callback when the dialog is dismissed

## Transaction Preparation

Calldata is prepared by pure functions in `src/utils/`, so the same code paths are exercised by the app and by tests:

- `prepareSetTexts(name, resolver, changes)` — encodes `setText` per changed record and wraps multiple changes in a resolver `multicall`, so any number of record edits is one signature.
- `fetchRenewalQuote(client, names, durationSeconds)` — queries the controller's `rentPrice` for every name and returns `{ pricePerNameWei, totalWei }`.
- `prepareRenewAll(names, durationSeconds, pricePerNameWei)` — encodes the UltraBulk `renewAll` call, stripping names to bare labels (the controller renews by label) and deriving `value` from the same encoded price so the two can never disagree.

## Batch Transactions

### EIP-5792 (`wallet_getCapabilities`)

For wallets that support EIP-5792, batch support is detected via viem's `getCapabilities` action:

1. On checkout, `wallet_getCapabilities` is called for the connected account
2. Support is reported when the wallet's `atomic` capability status is `supported` or `ready`
3. A badge informs the user that their wallet could batch multiple calls in one confirmation

### UltraBulk Contract

The UltraBulk contract at `0x7Ff29Bd08AF26495EeB96cb5D80f1813C0410917` provides batch renewals in a single transaction for any wallet:

```solidity
function renewAll(
  string[] memory names,
  uint256 duration,
  uint256 price
) external payable;
```

Verified on-chain semantics (tested against a mainnet fork):

- `price` is the **per-name** rent in wei for the full `duration`, as returned by the old ETH Registrar Controller's `rentPrice(name, duration)`
- Each name is renewed via `controller.renew{value: price}(names[i], duration)` against the pre-2023 controller at `0x283Af0B28c62C092C9727F1Ee09c02CA627EB7F5`, which is still an authorized controller on the BaseRegistrar
- `msg.value` must be **strictly greater** than `price * names.length` — the app sends `price * count + 1 wei`
- Excess value is not returned to the caller (the contract owner can sweep it), so the app quotes an exact price and re-quotes immediately before sending to guard against oracle drift

### Price Tiers

`rentPrice` depends on label length, so a single `price` parameter is only correct when all names in a batch share a tier:

| Tier | Label Length | Price/Year |
|------|--------------|------------|
| standard | 5+ chars | $5 |
| 4char | exactly 4 | $160 |
| 3char | 3 or fewer | $640 |

Names from different tiers cannot be combined in one batch renewal; the cart enforces this. The displayed total comes from a live `rentPrice` quote (ETH), refreshed every minute while the cart is open.

## Name Selection UX

See `docs/ui-requirements.md` for the current names-page interaction spec (select mode, filtering, expired-name handling).

- Names are displayed sorted by expiry date (soonest first)
- An expiry badge shows remaining time with color coding:
  - Red: < 30 days
  - Yellow: 30 days – 1 year
  - Green: > 1 year
- The cart sidebar shows selected names, a duration picker (1, 2, 3, 5, or 10 years), the per-tier yearly USD price, and the quoted ETH total
- If names from different price tiers are selected, an error message is shown and checkout is blocked

## Implementation Files

| File | Purpose |
|------|---------|
| `hooks/useTransaction.ts` | Transaction state machine + send orchestration |
| `hooks/useBatchCapability.ts` | EIP-5792 capability detection |
| `hooks/useRenewalQuote.ts` | Live `rentPrice` quote for the cart |
| `hooks/useCart.ts` | Cart state + price-tier logic |
| `utils/ens.ts` | `setText` / `multicall` calldata preparation |
| `utils/renewal.ts` | Rent quoting + UltraBulk `renewAll` calldata preparation |
| `components/transaction-modal.tsx` | Transaction flow modal UI |
| `components/renew-cart.tsx` | Renewal cart sidebar |
| `pages/edit.tsx` | Text record editor |
| `pages/names.tsx` | Owned names + selection |
