## Why

An audit of `apps/api` found code nothing reaches, a dependency and an environment variable
nothing reads, the project access rule written out in six repositories, a second error
hierarchy beside `AppError`, and repository methods only tests call. Each makes the backend
harder to read or to change safely; the duplicated access rule can let a fix reach five
places and miss the sixth.

## What Changes

- Delete unreachable code: four empty or unimported files, unused functions in reports and
  OpenAPI helpers, the `decimal.js` dependency, the `INVITE_CODE` variable and the finished
  migration's legacy inventory in the architecture test.
- Write the rule for which projects a member reaches once, in the shared kernel, and use it
  in every repository that filters projects.
- Replace the classes in `shared/presentation/http-errors.ts` with `AppError` where they
  were still thrown (avatar checks, the identity avatar route, the unmatched-route 404),
  delete the unused ones, and move `ServiceUnavailableError` into the concurrency gate that
  raises it, then delete the file.
- Drop the metric recording methods from the campaigns repository port; tests seed figures
  through Prisma as the other tests do.
- Drop a constructor parameter `PrismaLeadIntakeRepository` never read, and dead helpers the
  unexporting uncovered (`isChannel`, `isDeliveryStatus`).
- Stop exporting what only its own file uses, drop re-exports no one imports, and keep one
  export per module for `app.ts` and `prisma.ts`.
- No route, response, status code or schema changes.

## Capabilities

### New Capabilities

### Modified Capabilities

## Impact

- `apps/api/src` across composition, shared and most modules; `apps/api/test`;
  `apps/api/package.json`; `docker-compose.yml`, `.github/workflows/ci.yml`,
  `apps/api/.env.test`, `README.md`.
