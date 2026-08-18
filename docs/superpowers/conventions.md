# AdPulse — shared context for specs and plans

Context and conventions common to every design doc (`specs/`) and implementation plan
(`plans/`). Each phase document covers only what is specific to that phase and links
here for the rest.

## Product

AdPulse is a media buyer's dashboard: a backend REST API in `apps/api` and a React
frontend in `apps/web`, in an npm-workspaces monorepo. See the [README](../../README.md)
for the stack, repository layout and commands.

The wider product vision — mostly future scope, pursued one minimal phase at a time
(YAGNI): per-media-buyer data isolation and authentication, client management,
automatic metric calculation (CTR / CPM / CPC / CPL / ROAS), CSV import, AI campaign
analysis, and shareable public-link reports.

## Phases

| Phase | Topic | Spec | Plan |
|:---:|-------|------|------|
| 1 | Client CRUD | [design](specs/2026-07-20-adpulse-backend-clients-design.md) | [plan](plans/2026-07-20-adpulse-backend-clients.md) |
| 2 | Campaigns + daily stats grid | [design](specs/2026-07-21-adpulse-campaigns-design.md) | [plan](plans/2026-07-21-adpulse-campaigns.md) |
| 3 | Frontend shell + clients | [design](specs/2026-07-24-adpulse-frontend-shell-design.md) | [plan](plans/2026-07-24-adpulse-frontend-shell.md) |
| 4 | Campaign sheets | [design](specs/2026-08-03-adpulse-campaign-sheets-design.md) | [plan](plans/2026-08-03-adpulse-campaign-sheets.md) |
| 5 | Sheet creation and renaming | — | [plan](plans/2026-08-05-adpulse-campaign-management.md) |
| 6 | Sheet deletion and day entry | — | [plan](plans/2026-08-11-adpulse-sheet-management.md) |
| 7 | Cell editing | [design](specs/2026-08-12-adpulse-sheet-editing-design.md) | [plan](plans/2026-08-12-adpulse-cell-editing.md) |
| 8 | Sheet row management | [design](specs/2026-08-12-adpulse-sheet-editing-design.md) | [plan](plans/2026-08-12-adpulse-sheet-row-management.md) |
| 9 | Authentication — backend | [design](specs/2026-08-13-adpulse-auth-design.md) | [plan](plans/2026-08-13-adpulse-auth-backend.md) |
| 10 | Authentication — frontend | [design](specs/2026-08-13-adpulse-auth-design.md) | [plan](plans/2026-08-14-adpulse-auth-frontend.md) |

## How we work

These are canonical in [CLAUDE.md](../../CLAUDE.md); repeated here as the index for
design docs.

- **English only** — code, comments, docs, commit messages, API error messages.
- **Conventional Commits** — `type(scope): subject`; full table in [CONTRIBUTING](../../CONTRIBUTING.md).
- **TDD** — the failing test comes first in every task and is observed failing before
  the implementation.
- **Specs first** — each phase gets a design doc in `specs/` and a plan in `plans/`,
  named `YYYY-MM-DD-<topic>.md`.
- **Clean docs** — documents read as finished reference: no changelog, draft, or
  "updated" notes.

## Backend conventions

- API prefix `/api`; requests and responses are JSON.
- Layering: routes → controller (Zod validation) → service (Prisma) → PostgreSQL.
- Error envelope: `{ "error": { "message": string, "details"?: unknown } }`. Validation
  fails 400 (Zod issues in `details`), a missing record 404, a conflict 409, anything
  unexpected 500.
- Money and numeric values are `Decimal`, never float; they cross the API as strings
  with four decimals to preserve precision.

## Testing

- **Backend** tests need Postgres (`docker compose up -d db`) and use the separate
  `adpulse_test` database; `pretest` applies migrations to it automatically. Run from
  the repository root with `npm test`.
- **Frontend** tests use Vitest + Testing Library + MSW and need no backend or
  database: `npm run test:web`.

## Running the stack

The full stack (Postgres + API + web) runs from one command; see
[docs/running.md](../running.md) for which runner to use when.

## Docker and environments

- Postgres data lives in the named volume `adpulse_pgdata` and survives restarts. The
  `adpulse_test` database is a separate database in the same Postgres instance.
- Host commands (Prisma, tests) use `localhost:5432`; containers use `db:5432`.
