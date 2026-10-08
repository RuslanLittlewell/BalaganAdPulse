## Context

See proposal.md. The API is checked by 1570 tests that run through the real container, an
architecture test over the import graph, and `tsc`.

## Goals / Non-Goals

**Goals:**
- Remove what nothing reaches; write each rule once.

**Non-Goals:**
- Changing any route, response or status code, or removing an endpoint.
- Deleting `render.yaml` or the mock data seed, which wait on the owner's decision.
- Pruning exported types that form a module's public contract.

## Decisions

- **The access rule lives in `#shared/infrastructure/project-reach.ts`.** It is a Prisma
  `where` fragment, so it belongs with persistence, and every module's infrastructure can
  reach the shared kernel without crossing into another module.
- **`AppError` for every deliberate error, except overload.** The remaining
  `http-errors.ts` classes were thrown only in presentation and composition; `AppError`
  categories map to the same statuses and the same `{ error: { message } }` body, so
  responses do not change. `ServiceUnavailableError` carries `Retry-After`, which `AppError`
  does not, so it moves into `concurrency-gate.ts`, the only code that raises it, and the
  gate no longer imports from the presentation layer.
- **Metric recording leaves the port.** The Meta import writes figures in bulk inside its
  own transaction and never used these methods; only tests did. The adapter test seeds rows
  through Prisma like the other suites, and replacing a re-imported day stays covered by the
  import job's test.
- **Each step ends with the full suite**, so a regression points at one step.

## Risks / Trade-offs

- [An inline access filter differed slightly from the shared one] → each is compared before
  it is replaced, and reach tests cover every role per module.
