# Candidate task

Time box: 30–45 minutes. Assign one track: frontend, backend, Solidity, or Rust.

```bash
npm install
npm start
```

Complete only the assigned track. Leave the existing marks, feeds, and page structure in place. At the top of the submission, note what changed.

## Shared rule

A position is stale when its mark date is more than 3 calendar days before today, UTC. Compare dates, not clock times. A mark dated 2026-10-05 is stale on 2026-10-09. A mark dated 2026-10-06 is still fresh on 2026-10-09. A missing mark date is stale.

| Pricing method | Mark date |
| --- | --- |
| `token_spot` | `inputs.lastUpdatedAt` |
| `auction_price` | `inputs.auctionDate` |
| `appraisal_fx` | `inputs.fxDate` |

Tradable NAV is the sum of `navUsd` for positions that are not stale. The portfolio total still includes every position.

## Frontend

Edit `public/` only. The page already loads `GET /api/valuation`. The API does not return a stale field.

- Each stale row shows a text label, Stale. Fresh rows do not.
- The summary shows Tradable NAV beside the portfolio NAV.
- Both stay correct after Refresh marks.
- Refresh marks stays reachable from the keyboard.

Done when a refresh shows which rows are excluded from Tradable NAV.

## Backend

Edit the valuation response and its tests. Do not change `public/`.

- `positions[].stale`, boolean, using the shared rule.
- `positions[].markDate`, `YYYY-MM-DD`.
- `tradableNavUsd`, the sum of fresh `navUsd`.

Keep `totalNavUsd` as the sum of every position. Add a unit test that does not call the network. Cover a fresh mark, a mark 3 days old, a mark 4 days old, and a missing mark date.

Done when `npm test` passes and `GET /api/valuation` shows both totals.

## Solidity

Add only `contracts/NavBook.sol` and `test/NavBook.t.sol`. Use Solidity 0.8. `NavBook` stores one USD mark per asset id.

- `postMark(bytes32 assetId, uint256 navUsd, uint32 markDate)` is owner-only. `navUsd` uses 2 decimal places, so `1_000_00` means $1,000.00. `markDate` is `YYYYMMDD`.
- `postMark` reverts for a zero NAV, an impossible date, or a caller who is not the owner.
- `isStale(bytes32 assetId, uint32 today)` is true when the mark is missing or more than 3 calendar days before `today`.
- `tradableNav(bytes32[] assetIds, uint32 today)` sums fresh marks. An empty list returns 0. A stale or unknown id contributes 0.

Tests: the owner posts a mark; another address cannot post; zero NAV reverts; a mark dated today is fresh; 3 days old is fresh; 4 days old is stale; tradable NAV skips the stale id. Run `forge test` if Foundry is installed. Otherwise the test file must still name each case and the expected revert or return value.

## Rust

Add a library crate at `rust/nav_book`. No chain and no HTTP server. `nav_usd_cents` uses 2 decimal places. `mark_date` and `today` are `YYYYMMDD` integers.

- `post_mark` stores the mark and rejects a zero NAV or an impossible date.
- `is_stale` is true when the mark is missing or more than 3 calendar days before `today`.
- `tradable_nav` sums fresh marks. An unknown or stale id contributes 0.

`cargo test` must cover a stored mark, a rejected zero NAV, a rejected impossible date, fresh at 0 and 3 days, stale at 4 days, and a tradable sum that skips the stale id.

## Review

- 3 days is fresh, 4 days is stale, and a missing date is stale.
- Portfolio NAV includes every row. Tradable NAV does not include stale rows.
- The track can be checked with its own test, or with a visible refresh.
