# AdPulse

Media buyer's dashboard. Backend REST API in `apps/api` (TypeScript, Express,
PostgreSQL, Prisma, Zod), npm workspaces monorepo. See [README.md](README.md) for
the stack, layout and commands.

## Conventions

- **English only** — code, comments, docs, commit messages, API error messages.
- **Commit messages follow Conventional Commits** — `type(scope): subject`, imperative
  mood, lowercase, no trailing period. Full type table and examples in
  [CONTRIBUTING.md](CONTRIBUTING.md). Do not commit without an explicit request.
- **TDD** — write the failing test first, then the implementation, for each slice.
- **Specs first** — each phase gets a design doc in `docs/superpowers/specs/` and a
  plan in `docs/superpowers/plans/`, named `YYYY-MM-DD-<topic>.md`.

## Testing

Tests need Postgres running (`docker compose up -d db`) and use the separate
`adpulse_test` database. Run `npm test` from the repository root.
