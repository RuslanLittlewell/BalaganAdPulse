## Context

Prisma 6.19 reads a multi-file schema from a folder (generally available since 6.7). The
file with the `generator` block must be named `schema.prisma` and sit at the top of that
folder, with `migrations/` beside it. Without configuration the CLI reads only
`prisma/schema.prisma`.

## Goals / Non-Goals

**Goals:**
- One file per module, and no command that can read half the schema by accident.

**Non-Goals:**
- Changing any model, enum, index or migration.

## Decisions

- **`prisma/models/<module>.prisma`, `schema.prisma` and `migrations/` stay put.** The
  migration history does not move, and each file is named after the module that owns its
  tables. A table two modules touch lives with the module that writes it.
- **`prisma.config.ts` with `schema: "prisma"`, not `package.json#prisma`.** The
  `package.json` key is deprecated in Prisma 6. The config file matters for safety: left
  to its default, `prisma migrate dev` would read a `schema.prisma` with no models and
  propose dropping every table. With a config file Prisma stops loading `.env` itself, so
  the config imports `dotenv/config` and `DATABASE_URL` resolves as before.
- **Explicit `--schema` runs from the repository root pass the folder.** Those commands do
  not see `apps/api/prisma.config.ts`, so they name the folder directly.
- **Equivalence is checked, not assumed.** `prisma migrate diff` between the former single
  file and the folder must report no difference.

## Risks / Trade-offs

- [A command run outside `apps/api` without `--schema` reads nothing] → every such
  command in the repository passes `--schema apps/api/prisma`.
- [Production `migrate deploy` misses the config] → the image copies `prisma.config.ts`
  beside `prisma/`; `migrate deploy` needs only `datasource` and `migrations/`, both in
  `schema.prisma`'s folder either way.
