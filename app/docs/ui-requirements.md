# UI Requirements

Requirements for the app's pages and components. Items are written as testable behavior; the test-id contract at the bottom is shared between the UI and the e2e test suite.

## Homepage (`/`)

- Search-first layout: centered hero with a single search bar.
- The search icon must not overlap the input's placeholder or typed text.
- Recently visited names appear under the search as links.

## Search (search bar + Cmd+K)

- Typing a term always offers a direct "Go to `<name>`" lookup (appending `.eth` when no dot is present), page matches, and cached-name matches.
- Name results (lookup and cached) show the name's ENS avatar in the result row when one resolves; a neutral placeholder is shown while loading or when absent.

## My Names (`/names`)

- The page is centered (single centered column, not left-anchored two-column).
- A mini search input filters the listed names client-side for users with many names.
- Names that expired long ago (past the 90-day grace period) are tucked away: collapsed under a toggle, hidden unless the user expands them.
- **Select mode**: off by default. When off, every name row is a plain link to `/$name`. When select mode is enabled, clicking a row toggles its membership in the renewal selection instead of navigating.
- Bulk renewal is restricted (for now) to names of the same price category, based on label character count:
  - 3 or fewer characters → $640/yr tier
  - exactly 4 characters → $160/yr tier
  - 5+ characters → $5/yr tier
- Names sort by expiry, soonest first; unknown expiries sort last.
- Expiry badges: red < 30 days, yellow < 1 year, green otherwise; expired names say how long ago they expired.

## Name page (`/$name`)

- Two-column layout **only when the connected wallet can edit the name** (the management sidebar is the second column).
- For any name the viewer cannot edit — including all visitors who are not connected — the page is a single column.
- Resolver/registry ("Infrastructure") information moves out of the sidebar: shown at the bottom of the column (or behind a tab), not beside the profile.
- Management card (edit entry point) renders only when the connected wallet has edit permission, which is determined by simulating a `setText` against the name's resolver.

## Renewal cart

- Shows selected names with expiry dates, a duration picker, the per-tier USD yearly price, and a live ETH total quoted from the controller's `rentPrice`.
- Checkout is blocked while the quote is loading or when the selection mixes tiers.

## Test-id contract

The e2e suite locates elements exclusively through these `data-testid` values. UI changes must keep them stable.

| Test id | Element |
|---------|---------|
| `connect-wallet` | Navbar "Connect wallet" button (dialog trigger) |
| `connector-<connectorId>` | A connector row inside the connect dialog (e.g. `connector-injected`) |
| `wallet-profile` | Navbar profile dropdown trigger shown when connected |
| `search-input` | Homepage/search-bar text input |
| `names-search` | Mini filter input on `/names` |
| `select-mode-toggle` | Select-mode toggle on `/names` |
| `name-row-<name>` | A name row on `/names` (e.g. `name-row-luc.eth`) |
| `expired-section-toggle` | Toggle revealing long-expired names |
| `cart-duration` | Cart duration `<select>` |
| `cart-total` | Cart quoted total element |
| `cart-review` | Cart "Review & Renew" button |
| `cart-clear` | Cart "Clear" button |
| `tx-modal` | Transaction modal content |
| `tx-confirm` | Modal "Confirm" button (preview step) |
| `tx-done` | Modal "Done" close button (success/error step) |
| `tx-hash` | Modal transaction-hash link |
