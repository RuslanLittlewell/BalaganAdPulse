## 1. Split

- [x] 1.1 Move each module's models and enums into `prisma/models/<module>.prisma`, leaving `generator` and `datasource` in `schema.prisma`.
- [x] 1.2 Add `prisma.config.ts`; pass the folder to `--schema` in the Dockerfiles and CI; copy the config into the production image.
- [x] 1.3 Check every `.prisma` file for comments in the architecture test; update README and CLAUDE.md.
- [x] 1.4 `prisma validate`, `prisma migrate diff` against the former file reports no difference, `prisma generate`, `npx tsc --noEmit`, `npm test`, the production image build; `openspec validate split-prisma-schema --strict`.
