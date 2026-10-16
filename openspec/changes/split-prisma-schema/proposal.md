## Why

`apps/api/prisma/schema.prisma` holds all 31 models and 15 enums in one 790-line file, in
the order they were added, so finding a module's tables means scrolling past every other
module's. The API code is already split per module, and the composition root now is too.

## What Changes

- `prisma/schema.prisma` keeps only the `generator` and `datasource` blocks; each module's
  models and enums move to `prisma/models/<module>.prisma`, named after
  `src/modules/<module>`.
- `apps/api/prisma.config.ts` points the Prisma CLI at the `prisma` folder, so every
  command run in `apps/api` reads the whole schema without a flag, and loads `.env` as the
  CLI did before a config file existed.
- The Dockerfiles and CI pass the folder instead of the single file to `--schema`; the
  production image also carries `prisma.config.ts`.
- The architecture test keeps every `.prisma` file free of comments.
- The database schema does not change: no migration, identical generated client.

## Capabilities

### New Capabilities

### Modified Capabilities

## Impact

- `apps/api/prisma/`, `apps/api/prisma.config.ts`, `apps/api/Dockerfile`,
  `apps/api/Dockerfile.prod`, `.github/workflows/ci.yml`,
  `apps/api/test/architecture/hexagonal-boundaries.test.ts`, `README.md`, `CLAUDE.md`.
