## Why

A project with several advertising accounts switches its summary to the chosen account's
figures and KPIs, but every account shows the same tiles in the same order. Accounts are
judged by different figures — leads on one, clicks and CPC on another — so each needs its own
set.

## What Changes

- When a project's summary is split by account, each account's tab has its own tiles and
  order, chosen and rearranged the way the project's are.
- A tab whose tiles nobody has chosen shows the project's tiles, so nothing changes until
  somebody chooses.
- A campaign page shows the tiles of its campaign's account, or the project's when that
  account has none of its own.
- A project with one account or none keeps the project's tiles, as today.
- The project tiles API reads every account's choice alongside the project's, and saves a
  choice for one account when the request names it.

## Capabilities

### New Capabilities

### Modified Capabilities
- `summary-tiles`: each account of a project split by account keeps its own tiles, falling
  back to the project's; campaign pages follow their account.

## Impact

- Database: a new table of tiles per project and account; nothing is migrated.
- `apps/api/src/modules/summary-tiles`: reading and saving per account, audit, OpenAPI.
- `apps/web/src/entities/summary-tiles`: the account choices, the fallback and the optimistic
  save per account.
- `apps/web/src/pages/project` and `apps/web/src/pages/campaign`: show and save the tiles of
  the account in view.
