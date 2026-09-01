## Why

The API is expected to grow substantially, while its current `routes → controller → service → Prisma`
structure lets business rules, authorization, transactions and infrastructure concerns accumulate in
the same service files. Establishing hexagonal boundaries now keeps future modules independently
testable and prevents Express, Prisma, storage and audit details from becoming dependencies of the
business logic.

## What Changes

- Adopt a module-oriented Clean/Hexagonal Architecture for the API, with domain, application,
  infrastructure and presentation boundaries plus an explicit composition root.
- Add enforceable import rules so dependencies point inward and cross-module access goes through
  public application contracts.
- Introduce a small shared kernel for domain errors, actor identity, clocks, UUID generation and an
  explicit unit-of-work transaction port.
- Migrate identity (`auth`, sessions and user profiles) first, then `invites` and `members`, followed
  by `clients` and `projects`, then campaigns, properties, records and values, and finally audit.
- Keep mutation and audit writes atomic by making audit an application port participating in the same
  unit of work as repositories.
- Remove the legacy service/controller implementation only after each migrated module has equivalent
  contract and integration coverage.
- Preserve all HTTP paths, payloads, status codes, authorization behavior, database schema and
  externally observable application behavior throughout the migration.

## Capabilities

### New Capabilities

None. This change restructures implementation boundaries without adding product behavior.

### Modified Capabilities

None. Existing capability requirements and HTTP contracts remain unchanged.

## Impact

- **API source layout:** `apps/api/src` moves toward `modules/*`, `shared/*` and `composition/*`.
- **Tests:** adds architecture tests, pure application tests with in-memory ports, and parity coverage
  around every migrated HTTP module.
- **Runtime wiring:** Express routers receive composed handlers/use cases instead of importing Prisma
  services directly.
- **Transactions:** Prisma remains the production adapter, behind a unit-of-work abstraction that also
  supplies transactional audit and repository adapters.
- **No external breakage:** routes, response shapes, error envelope, authorization semantics,
  migrations and deployment remain compatible.
