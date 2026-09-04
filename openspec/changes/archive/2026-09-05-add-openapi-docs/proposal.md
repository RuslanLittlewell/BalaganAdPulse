## Why

The API's surface is only knowable by reading `create-routes.ts` and eight routers
beside it. Nothing tells a frontend developer, or the next person wiring an integration,
which endpoints exist, what a request body has to contain or what comes back. The Zod
schemas already state every request shape precisely; they are simply not published.

## What Changes

- The API describes itself as an OpenAPI 3.1 document, served at `GET /api/openapi.json`.
- The document is browsable and callable through Swagger UI at `GET /api/docs`, served
  from assets shipped with the app rather than a CDN.
- Request bodies and query parameters in the document are derived from the Zod schemas
  that already validate them, so a schema change cannot leave the document behind.
- Every module states its own operations next to its router; the composition root
  assembles them under the mount paths it already owns.
- A test enumerates the routes Express actually mounts and requires the document to
  describe exactly those — no missing operation, no invented one.
- Both endpoints answer without authentication, and an operator can withdraw them with
  `API_DOCS=off`.
- No breaking change: nothing about an existing endpoint moves or changes shape.

## Capabilities

### New Capabilities

- `api-documentation`: the API publishes a machine-readable description of itself and a
  page to browse it.

## Impact

- `apps/api`: a document builder in `shared/presentation`, an operations file beside each
  module's router, assembly and mounting in `composition`, one new mount in `ROUTE_MOUNTS`.
- One new runtime dependency, `swagger-ui-dist`, for the browsable page's assets.
- `apps/web`: untouched.
- No Prisma schema change and no migration.
