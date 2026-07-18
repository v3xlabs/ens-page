# Names Hub — Design

Design for evolving `/names` into a name-management hub, and `/activity` into a persistent
transaction center. Interactive mockup (thorin tokens, Satoshi, light/dark, working
interactions): https://claude.ai/code/artifact/b6ebcfa6-c6fc-457c-935c-2063cecd341d

Everything here extends `docs/ui-requirements.md`; the test-id contract there stays valid and
grows with new features.

## Information architecture

Plain clickable header links above the cards (no container, background, or borders —
bold text, active section in text-primary, inactive in text-secondary):

| Header | Route | Purpose |
|--------|-------|---------|
| Names | `/names` | Portfolio: filter, select, renew, pool from selection |
| Pools | `/pools` | Automated renewal pools: create, fund, monitor |
| Pool detail | `/pool/$poolId` | One pool, wider layout (`max-w-4xl`); the id becomes the contract address once pools deploy |
| Activity | `/activity` | In-flight flows + full history |

Header counts show live totals (names, pools). Pools stays highlighted on `/pool/*`.

Pools are public contracts; a pool's label is a **private local note**. To name a pool
publicly, the owner points an ENS name at the pool address after deployment — the UI says
so at creation and on the detail page.

## Names tab

- **Pagination, not one long list.** Page size ~10–25 via TanStack-style pagination controls
  at the card footer (`1–10 of 29`, numbered pages). Virtualization is unnecessary at ENS
  portfolio sizes once paginated; pagination also keeps row DOM stable.
- **Selection must never rebuild the list.** The current implementation re-creates rows on
  every toggle (page flashes and scrolls to top). Fix: keyed rows (`<For>` over a stable
  array identity; selection state read per-row from the cart store) so a toggle only flips
  one row's classes. Selection persists across pages and filters.
- Filter chips with live counts: All / Expiring soon / In grace / In a pool. Mini search
  filters client-side. Long-expired (past 90d grace) names stay tucked behind a collapsed
  toggle.
- Rows: gradient avatar, name, expiry badge + date, tier tag (`$5/yr` etc.), pool membership
  tag when applicable, `not yours` tag for externally added names.

### Selection → checkout panel

A sticky bottom panel (slides up when selection is non-empty) that is a real cost breakdown,
not a one-liner:

- Header: `N names selected · K price tiers → K transactions`, duration select, and the
  secondary action **⬡ Pool these names** (jumps to pool creation seeded with the selection).
- Breakdown: one line per tier — `2 × standard (5+ chars) [$5/yr] … 2 × 0.00538 = 0.01076 ETH`
  — so the user sees exactly where the total comes from. External names get their own line:
  `includes 1 name you don't own — renewals are permissionless`.
- Footer: "Add any name" input (auto-appends `.eth`; adds to the batch marked `not yours`),
  total labeled with its source (`controller rate, refreshes 60s`), and **Review & Renew**.
- Review modal groups line-items per tier as `Transaction 1..K` (UltraBulk takes one price
  per call). With EIP-5792 support the K transactions are submitted as one wallet
  confirmation; otherwise sequentially with per-transaction steps.

## Pools

A pool is a small contract holding funds that anyone may use to execute renewals for its
member names once the owner's conditions are met.

### Pool list

Cards: label, status tag (`Funded` green / `Streaming` yellow / `Needs top-up` red),
capability chips, avatar stack of members, stats (names / balance / runway-or-inflow) and a
runway bar. Create-pool card: label (kept locally), initial deposit, deploy; reachable seeded
from a names-tab selection.

### Capability chips

Surfaced on both the card and the detail header so a pool's powers are legible at a glance:

- `⇄ stream` (yellow) — accepts Superfluid streams.
- `⇆ USDC · Uniswap` (pink) — auto-swap automation enabled: the pool accepts USDC (or other
  configured tokens) and swaps to ETH via Uniswap on receipt/keeper trigger.

### Pool detail

- **Header card (funding merged in):** label + status/capability tags; **big balance**;
  **pool address** prominently labeled "send ETH or USDC to top up" with copy; Top up /
  Withdraw; runway bar with a plain-language line ("Renewals cost 0.35 ETH/year across 4
  names — balance covers ~3.3 years").
- **Pending card (forecast):** the renewal queue in execution order — numbered rows with
  name, `renews in ≤ 25d`, per-renewal cost, and state (`waiting for gas < 12 gwei` /
  `queued`), plus a coverage line ("All 4 covered by current funding ✓" or a shortfall
  warning). This is the pool's heartbeat; it answers "what happens next and can we afford
  it".
- **Inflows card:** totals row — total incoming/mo, *from you*/mo, suggested rate — then the
  per-contributor stream list (others can stream into your pool; contributors marked, you
  tagged). Buffer slider (0–50%) recomputes the suggested rate
  (`yearly renewal cost × (1 + buffer) / 12`); "Adjust your stream to match" applies the
  delta when members change.
- **Names card:** members with expiry + cost/yr, `not yours` tag for external names, remove,
  and "Add any name — yours or not".
- **Automation card:** renew horizon (days before expiry), gas ceiling (relaxes as expiry
  approaches so names never lapse), relayer tip, and the auto-swap toggle
  (`USDC → ETH · Uniswap`).
- **Funding history card (full width):** who topped up, how much, when — with method icons:
  `⤓` direct transfer, `⇄` stream, `⇆` swap (shows original token: `250 USDC → 0.134 ETH`).

## Activity page

Two layers, both fed from a persisted store:

1. **In progress** — resumable multi-step flows rendered as step chips
   (`✓ Commit · tx` → `● Waiting 0:42` → `○ Register`):
   - ENS registration (commit → min-commitment-age wait → register) with a live countdown
     and a Register CTA that arms when the wait elapses.
   - Renewals awaiting Safe signatures (`1 of 2`, "Open in Safe").
   - Any pending transaction with its hash, awaiting confirmation.
   Copy states the guarantee explicitly: *"Safe to close this tab — the flow is saved
   locally and resumes in any tab."*
2. **History** — day-grouped feed: relayer renewals (gas price, cost, tip, tx link), stream
   deposits, pool membership changes, manual bulk renewals (tier/transaction count).

### Persistence

Transaction flows and their step state live in a localStorage-persisted TanStack store
(`@tanstack/query-persist-client` for server-state caches; a small versioned store for flow
state — same `createStoredSignal` pattern already used for cart/settings). Reload, new tab,
or crash mid-flow lands the user back in Activity with the flow where they left it. Chain
state is the source of truth on resume: a "pending" commit that's now mined advances the
step; an expired commitment (>24h) marks the flow failed with a restart action.

## Implementation notes

- Fix the select-mode flash first (stable keyed rows); it's a defect independent of the
  redesign.
- Phase order: (1) tabs + names tab (pagination, checkout panel, external names),
  (2) activity page with persisted flows for the existing renewal path, (3) pools read-only
  UI against a pool contract prototype, (4) streams + swap automation.
- Pool contract (out of scope here, sketched for the UI): holds ETH; `renew(names[])`
  callable by anyone, validates owner-set conditions (horizon, gas ceiling via oracle or
  optimistic check, tip payout); owner manages member set + config; optional Superfluid
  inflow; optional token-swap hook. UI treats capabilities as feature flags per pool.
- New test-ids to add to the contract table when implemented: `tab-names`, `tab-pools`,
  `tab-activity`, `checkout-panel`, `checkout-breakdown`, `checkout-add-name`,
  `checkout-pool-from-selection`, `names-pager`, `pool-card-<id>`, `pool-pending`,
  `pool-inflows`, `activity-flow-<id>`.
