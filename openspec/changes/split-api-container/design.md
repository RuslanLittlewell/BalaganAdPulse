## Context

The composition root is the only place allowed to construct concrete adapters, and both
`app.ts` and `server.ts`, as well as tests, call `createContainer()` and read
`ApiContainer`. `INTEGRATION_ENCRYPTION_KEY` and `META_GRAPH_VERSION` are read from
`process.env` when the container is built; tests stub them just before building it.

## Goals / Non-Goals

**Goals:**
- One file per module that shows how that module is wired and what it takes from others.
- A `createContainer` that reads as the order modules are assembled in.

**Non-Goals:**
- Changing `ApiContainer`, routes, middleware order or any module's ports.
- Moving the integration variables into `config.ts`: it is read once at import, which would
  stop the tests' stubs taking effect and change when the key is read.

## Decisions

- **Group by module, wiring use cases with their routers.** Files: `kernel` (unit of work,
  clock, ids, audit, realtime connections), `clients-projects` (clients, projects, project
  layout), `invites`, `identity`, `members-presence` (members, presence, its delivery),
  `campaigns-integrations` (campaigns, integrations and both workers), `tasks`, `leads`
  (leads, files, intake), `reports-kpi`. Modules that always travel together share a file
  rather than splitting into a dozen tiny ones.
- **Cross-module needs are parameters.** `wireIdentity(kernel, { invites, signedOut })`
  rather than reaching into a shared bag, so a file's signature lists exactly what it
  depends on. Identity's routers need presence to sign a member out; `wireIdentity` takes a
  `signedOut` callback and the container passes `presence.leave` once presence exists,
  which keeps identity from depending on presence's wiring.
- **The kernel is a plain object.** Every `wire…` takes it first.
- **`runDetached(label, work)`** in the kernel replaces five copies of
  `void promise.catch((error) => console.error(label, error))`, with the same messages.

## Risks / Trade-offs

- [The dependency graph is no longer on one screen] → `createContainer` lists the calls in
  order, and each signature names its dependencies.
- [A wire built twice or in another order changes behaviour] → every router and middleware
  is still built once, and the API suite, which runs through the real container, guards it.
