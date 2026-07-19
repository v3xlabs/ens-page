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
| `names-filter` | Status filter dropdown on `/names` |
| `select-mode-toggle` | Select-mode toggle on `/names` |
| `name-row-<name>` | A name row on `/names` (e.g. `name-row-luc.eth`) |
| `expired-section-toggle` | Toggle revealing long-expired names |
| `cart-duration` | Cart duration `<select>` |
| `cart-total` | Cart quoted total element |
| `cart-review` | Cart "Review & Renew" button |
| `cart-clear` | Cart "Clear" button |
| `tx-modal` | Transaction modal content |
| `tx-summary` | Persistent summary block in the transaction modal (what is being approved) |
| `tx-fee` | Estimated-network-fee row inside the summary block |
| `tx-confirm` | Modal "Confirm" button (preview step) |
| `tx-done` | Modal "Done" close button (success/error step) |
| `tx-hash` | Modal transaction-hash link (first hash when a sequence produced several) |
| `tab-names` / `tab-pools` / `tab-activity` | Hub segmented-tab links |
| `names-pager` | Pagination footer on the names list |
| `checkout-panel` | Sticky selection checkout panel |
| `checkout-breakdown` | Per-tier cost breakdown block in the panel |
| `checkout-add-name` | "Add any name" input in the panel |
| `checkout-pool-from-selection` | "Pool these names" secondary action |
| `pool-create` | Create-pool button on the pools tab |
| `pool-create-label` / `pool-create-submit` | Label input and submit in the create-pool card |
| `pool-card-<poolId>` | A pool card in the pools grid |
| `pool-pending` | Pending (forecast) card in pool detail |
| `pool-inflows` | Inflows card in pool detail |
| `pool-fund` / `pool-withdraw` | Funding actions in the pool detail header |
| `fund-choice` | Funding choice dialog shown before the transaction flow |
| `fund-tab-token` / `fund-tab-stream` | Tabs inside the funding choice dialog |
| `fund-token-select` / `fund-amount` / `fund-duration` | Funding choice inputs |
| `fund-review` | Advances from the funding choice to the transaction review |
| `pool-funding-amount` | Amount input inside the withdraw modal |
| `pool-adapters` | Adapters section inside the pool configuration card |
| `adapters-edit` | Enters the staged adapters/routes edit mode (owner) |
| `adapter-check-<kind>` | Enable checkbox for an adapter in edit mode (`swap`, `yield`, `stream`) |
| `route-kind-<symbol>` / `route-fee-<symbol>` / `route-guard-<symbol>` / `route-floor-<symbol>` | Per-token route fields in edit mode |
| `adapters-save` | Reviews all staged adapter/route changes as one transaction |
| `route-convert-<symbol>` | Executes a configured route over the pool's token balance |
| `add-token-input` / `add-token-submit` | Tracks an arbitrary ERC20 (metadata probed on-chain, 4626 vaults detected) |
| `token-remove-<symbol>` | Stops tracking a custom token |
| `pool-streams` | Streams card on the funding tab |
| `stream-claim-<streamId>` | Claim button for a stream's accrued amount |
| `pool-config-edit` / `pool-config-save` | Pool configuration edit toggle and save |
| `pool-config-duration` / `pool-config-gas` / `pool-config-premium` | Pool configuration number inputs |
| `pool-config-window` | Renewal-window slider (`input[type=range]`, stops 10/20/30/60/90/180/365 days; value is the stop index) |
| `pool-label-edit` / `pool-label-input` / `pool-label-save` | Inline editor for the pool's private label note |
| `pool-names-edit` | Opens the pool names editor dialog |
| `pool-names-input` | Name search input inside the names editor |
| `pool-names-remove-<name>` | Removes a name from the editor draft |
| `pool-names-review` | "Review changes" button in the names editor |
| `edit-records` | "Edit records" button on `/$name` |
| `record-input-<key>` | A record input on `/$name/edit` (e.g. `record-input-description`) |
| `edit-save` / `edit-reset` | Save and reset actions on `/$name/edit` |
| `fairy-badge-<name>` | ensfairy.eth avatar shown beside names the fairy holds (available for adoption) |
| `activity-flow-<activityId>` | An in-progress flow card on the activity page |
