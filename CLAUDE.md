# AdPulse

Media buyer's dashboard. Backend REST API in `apps/api` (TypeScript, Express,
PostgreSQL, Prisma, Zod), npm workspaces monorepo. See [README.md](README.md) for
the stack, layout and commands.

## Conventions

- **No comments** — the codebase carries none, and none are to be added: not in
  TypeScript, not in `schema.prisma`, not in configs. A comment you were about to
  write is a name that should have been clearer, a function that should have been
  smaller, or a decision that belongs in `openspec/` or a commit message. The two
  exceptions are machine-read directives (`/// <reference …>`, pragmas) and files
  vendored from elsewhere (`apps/web/src/shared/ui/ui/`, `apps/api/prisma/migrations/`),
  which are kept as they arrived.
- **English in the codebase, Russian in the interface** — code, docs, commit
  messages and API error messages are English. Everything a user reads in the web
  app is Russian and lives in `apps/web/src/shared/config/ru.ts`; reach it through
  `t("key")` rather than writing copy inline.
- **Commit messages follow Conventional Commits** — `type(scope): subject`, imperative
  mood, lowercase, no trailing period. Full type table and examples in
  [CONTRIBUTING.md](CONTRIBUTING.md). Do not commit without an explicit request.
- **TDD** — write the failing test first, then the implementation, for each slice.
- **No tests for styles** — never assert on CSS classes, inline styles or computed
  colours, spacing and borders. Styling is changed on sight and such a test fails on
  a redesign that broke nothing. Test what the component does: the text and roles it
  renders, the handlers it fires, what the keyboard reaches, the accessible names and
  states (`data-*`, `aria-*`) it exposes.
- **Specs first, through OpenSpec** — planning artifacts live in `openspec/`. Scaffold
  a change with `openspec new change "<name>"`, then write its `proposal.md`,
  `specs/<capability>/spec.md`, `design.md` and `tasks.md`, guided by
  `openspec instructions <artifact> --change "<name>" --json`. Never create a change
  directory by hand. `openspec validate <name> --strict` must pass before implementation
  starts, and the change is archived once its tasks are done. Phases 1–12 predate this
  and are kept as history in `docs/archive/phases-1-12/`.

## Testing

Tests need Postgres and the S3-compatible storage running
(`docker compose up -d db storage-init`) and use the separate `adpulse_test`
database. Run `npm test` from the repository root.
