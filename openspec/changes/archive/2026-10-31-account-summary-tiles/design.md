## Context

A project's tiles are one ordered array on `project.summary_tiles`. The project page already
splits its summary by account when it has more than one, the way project KPIs name an account
by `channel` and `sourceAccountId`. The campaign page reads the project's tiles and adds its
own KPI tile.

## Goals / Non-Goals

**Goals:**
- Per-account tiles and order on a split project page, falling back to the project's.
- Campaign pages following their account.

**Non-Goals:**
- Going back from an account's own tiles to the project's; choosing again does the job.
- Removing an account's tiles when its connection is removed: reconnecting brings them back.
- Checking that a named account belongs to the project, which KPIs do not check either.

## Decisions

- **A table keyed by project, channel and account ID** (`project_account_summary`), with an
  id and a unique key in the manner of `project_kpi`, cascading with the project. An absent
  row means "use the project's tiles", so no data migration is needed and the fallback is a
  read-side rule.
- **One read for the whole project.** `GET /projects/:id/summary-tiles` gains `accounts`, a
  list of `{ account: { channel, accountId }, tiles }`. The project page switches tabs and the
  campaign page finds its account without further requests, and both share one cache entry.
- **The account travels in the body**, `account: { channel, accountId } | null`, as project KPIs
  name theirs; the path stays the same and an old client keeps saving the project's tiles.
  `PUT` answers with the same shape as `GET`.
- **The fallback lives in the summary-tiles entity** (`tilesOf`), so both pages apply the same
  rule; the optimistic update writes into the account's entry or the project's list.
- **The first change in a tab starts from the project's tiles**, because the summary shows them
  and passes the edited list, which is then stored for the account.

## Risks / Trade-offs

- [A project dropping back to one account shows the project's tiles while its campaigns keep
  the remaining account's own] → rare, and both stay editable; the account's tiles return when
  the project is split again.
- [`summary-tiles` main spec still holds a requirement that says campaign pages follow the
  project page] → it is already superseded by the unarchived `project-summary-shared`; this
  change adds the per-account rule without restating it.
