## Context

Eight routers are mounted under `/api` by `composition/create-routes.ts`, each validating
its input with Zod schemas that sit beside it in `presentation/http/`. Those schemas are
already the precise statement of what every endpoint accepts; the document has to be
built from them rather than written next to them, or the two drift apart on the first
edit and the document stops being worth reading.

Zod 4 converts a schema to JSON Schema natively (`z.toJSONSchema`), and OpenAPI 3.1 is a
superset of JSON Schema draft 2020-12, so no adapter library is needed for the schemas.
What is needed is a place to say the things a validating schema does not know: the path,
the method, the status codes, the response shape.

## Goals / Non-Goals

Goals:

- One document covering every mounted endpoint, built at startup from live schemas.
- A description that fails the test suite when a router and the document disagree.
- A browsable page that works with no third-party network access.

Non-Goals:

- Generating a client from the document — nothing in `apps/web` changes here.
- Describing the WebSocket surface: it is not HTTP and OpenAPI cannot express it.
- Versioning the document, or publishing it outside the running API.

## Decisions

### Operations live with the routers, mount paths stay in composition

Each module gains `presentation/http/<module>-openapi.ts` exporting its operations, with
paths written relative to the mount, exactly as the router writes them — `/`, `/:id`,
`/:id/access`. The composition root pairs each set with the mount path it already holds
in `ROUTE_MOUNTS` and rewrites `:id` into `{id}` on the way.

The alternative — one document file in `composition/` — was rejected: it puts the
description of an endpoint a directory tree away from the endpoint, which is precisely
the distance that lets the two diverge unnoticed. Modules stay ignorant of where they are
mounted, as they are today.

### Requests are converted, responses are declared

Request bodies and query parameters are converted from the module's own Zod schemas with
`z.toJSONSchema(schema, { target: "draft-2020-12", io: "input", unrepresentable: "any" })`.
`io: "input"` matters: several schemas transform on the way in — a `YYYY-MM-DD` string
becomes a `Date`, an email is trimmed and lowercased — and the document has to state what
a caller sends, not what the use case receives.

Responses have no such schema to borrow, because a use case returns a TypeScript value
that Express serialises. Each module therefore declares its response schemas as Zod
objects in the same file, registered as named components and referenced by `$ref` so a
record shape is written once. `Date` fields are declared as `date-time` strings, which is
what `res.json` actually sends.

### The document is assembled once, at startup

`buildOpenApiDocument` runs when the container is created and the result is held. The
document is a pure function of the schemas, so nothing is gained by rebuilding it per
request, and `GET /api/openapi.json` never touches the database.

### The drift guard reads the routers, not the source

The test walks the composed Express router: each mount from `ROUTE_MOUNTS` paired with
its router's stack yields every `(method, path)` pair the API really serves. That set is
compared with the document's. This catches an endpoint added without its description, one
described but deleted, and a method documented on the wrong path — none of which a
hand-kept list would catch.

### Swagger UI is served from the app's own dependencies

`swagger-ui-dist` is added as a runtime dependency and its directory is resolved with
`createRequire(import.meta.url).resolve("swagger-ui-dist/package.json")`; the package
ships no types, and resolving it as a path rather than importing it keeps the type
checker out of the question. The docs router serves that directory statically under
`/api/docs` and answers its own root with a small HTML page pointing Swagger UI at
`/api/openapi.json`, with absolute asset URLs so the page renders whether or not the
request carried a trailing slash.

A CDN-hosted page was rejected: the app runs in Docker for development and on Render in
production, and documentation that goes blank without a third-party network is
documentation that will be blank the day it is needed.

### The mount goes first, and can be withdrawn

`/api/docs` and `/api/openapi.json` are mounted ahead of the authentication middleware,
which is mounted on the whole of `/api`; being reachable without a session is the point.
`API_DOCS=off` leaves the router out of the composition entirely, so the catch-all at the
end of `/api` answers 404 exactly as it does for any path nobody serves. The default is
on: a documentation page an operator has to remember to enable is one nobody reads.

## Risks / Trade-offs

- Response schemas are hand-written and can fall behind the use cases that produce them.
  Mitigated by keeping them in the module that owns the record, next to its router, and
  by referencing one component per record rather than repeating shapes per operation.
- `swagger-ui-dist` is a few megabytes in the production image. Accepted: it is static
  assets, it carries no server-side code, and the alternative is a page that depends on
  a network the app has no other reason to reach.

## Migration Plan

None. No Prisma schema change, no data touched, and no existing endpoint moves or changes
shape. The new dependency means containers need rebuilding rather than restarting, since
`node_modules` is a volume in `docker-compose.yml`.

## Open Questions

None.
