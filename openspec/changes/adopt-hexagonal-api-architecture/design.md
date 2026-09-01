## Context

See proposal.md — Why. The API currently groups files by technical endpoint and follows
`routes → controller → service → Prisma`. Services directly import Prisma, authorization helpers,
audit writers and storage, so a business operation's rules and transaction boundary are coupled to
its delivery and persistence mechanisms. The suite has strong HTTP integration coverage, which makes
an incremental migration possible without changing external behavior.

Constraints:

- Express 5, Zod, Prisma and PostgreSQL remain the production adapters.
- Existing routes, payloads, status codes, error envelopes and authorization/scoping semantics remain
  byte-for-byte compatible where tests assert them.
- Audit writes must remain in the same database transaction as their business mutation.
- Unreachable resources continue to answer 404, never 403.
- The migration must coexist with feature delivery and cannot be a big-bang rewrite.

## Goals / Non-Goals

**Goals:**

- Make domain and application code independent of Express, Zod, Prisma, S3 and process globals.
- Give each business module an explicit public API and inward-only dependency graph.
- Make use cases testable with in-memory ports while retaining HTTP/database integration tests.
- Represent time, identifiers, persistence, transactions and audit as explicit dependencies.
- Migrate one vertical slice at a time with continuous contract parity and a green main branch.
- Leave a repeatable module template for task board, comments, attachments and portal features.

**Non-Goals:**

- Changing product behavior, HTTP contracts, database schema or frontend contracts.
- Introducing event sourcing, CQRS, microservices, a message broker or a runtime DI framework.
- Creating generic CRUD repositories or a universal base entity.
- Removing Prisma, Express or Zod; they move to adapters rather than disappear.
- Forcing rich domain objects where a typed application DTO and focused invariant are sufficient.

## Decisions

### Organize by business module, then by hexagonal layer

The target layout is:

```text
apps/api/src/
  modules/
    identity/
      domain/
      application/
      infrastructure/
      presentation/
      index.ts
    invites/
      domain/
      application/
        ports/
        use-cases/
      infrastructure/prisma/
      presentation/http/
      index.ts
    members/
    clients/
    projects/
    campaigns/
    audit/
  shared/
    domain/
    application/
    infrastructure/
    presentation/
  composition/
    create-container.ts
    create-routes.ts
```

Dependencies point inward inside a module:

```text
presentation ─┐
              ├─> application ─> domain
infrastructure┘

composition ─> every outer adapter and application port
```

`domain` imports only the language/runtime and other domain files in the same module or the deliberately
small shared kernel. `application` imports domain and port interfaces. Infrastructure implements ports;
presentation translates HTTP to/from use-case inputs and outputs. Only `composition` constructs concrete
adapters.

Alternative considered: top-level `domain/application/infrastructure` directories. It makes layer rules
obvious but scatters one feature across the repository and becomes harder to navigate as the number of
modules grows. Module-first layout keeps ownership local while preserving the same dependency direction.

### Each module exposes one explicit public surface

Other modules and the composition root import a module through its `index.ts`. Deep cross-module imports
are forbidden. The public surface contains use-case factories/types and intentional domain contracts,
never Prisma repositories or Express handlers. Direct module-to-module dependencies are kept rare; when
coordination is necessary, an application port names the capability the consumer needs.

Alternative considered: allow application layers to import each other freely. This is initially faster
but recreates a distributed service layer with cycles. Explicit ports preserve replaceability and expose
coupling during review.

### Enforce boundaries with an architecture test

A Vitest architecture test parses all API imports and fails on forbidden edges:

- domain → application, infrastructure, presentation, Express, Zod, Prisma or S3;
- application → infrastructure, presentation, Express, Zod or Prisma;
- infrastructure → presentation;
- presentation → infrastructure or Prisma;
- any deep import into another module;
- any concrete adapter construction outside `composition`.

The test also rejects new files in the legacy technical directories once their module has migrated. It
starts with an explicit allow-list for unmigrated legacy files, and the allow-list only shrinks.

Alternative considered: documentation alone. Import boundaries are easy to violate accidentally and code
review is an unreliable graph checker. A lightweight repository test avoids adding a build-time dependency
and runs in the existing suite.

### Keep the shared kernel deliberately small

The shared kernel contains only concepts needed by multiple modules:

- transport-independent `AppError` categories (`validation`, `not-found`, `forbidden`, `conflict`);
- authenticated `ActorContext`, using the role vocabulary from the pure `access-policy` package;
- `Clock` with `now(): Date`;
- `IdGenerator` with `generate(): string`;
- opaque `TransactionContext` and `UnitOfWork`;
- primitives whose semantics are genuinely shared, not module-specific DTOs.

The system clock, UUID generator and Prisma unit of work live in infrastructure. Tests use fixed clocks,
deterministic ids and in-memory adapters. The existing error middleware maps `AppError` categories to the
unchanged HTTP envelope and status codes.

Alternative considered: a broad `common` directory. Such directories become dependency dumping grounds.
Every shared-kernel addition must have at least two real module consumers and no infrastructure import.

### Use explicit use-case functions with constructor/factory injection

Use cases are plain functions or small classes created with their required ports. No decorator-based DI
container or service locator is introduced. A use case receives `ActorContext` and validated input and
returns an application result; it never receives Express `Request`/`Response` or reads global Prisma.

```ts
interface CreateInviteDependencies {
  invites: InviteRepository;
  ids: IdGenerator;
  clock: Clock;
  unitOfWork: UnitOfWork;
  audit: AuditWriter;
}

const createInvite = (deps: CreateInviteDependencies) =>
  async (actor: ActorContext, input: CreateInviteInput): Promise<InviteDto> => { /* ... */ };
```

Factories keep tests direct and make missing dependencies compile-time errors. The composition root owns
singleton lifetimes and route wiring.

Alternative considered: Inversify/TSyringe. Runtime metadata and container lookups hide dependencies and
add machinery without solving a current requirement.

### Model persistence with use-case-shaped ports

Repository interfaces live beside the application use cases that consume them. Their methods express
business queries such as `findReachableProject` or `replaceMemberGrants`, not Prisma's generic CRUD API.
Domain/application types do not expose Prisma models, `Prisma.Decimal`, delegates or filter objects.
Numeric persistence adapters convert between domain strings/value objects and Prisma decimals at the edge.

Alternative considered: `Repository<T>` with generic find/save/delete. It leaks persistence-shaped
thinking, cannot represent scoped queries safely and encourages callers to rebuild authorization filters.

### Represent atomicity with an opaque transaction context

The shared application layer defines:

```ts
export interface TransactionContext { readonly kind: unique symbol }

export interface UnitOfWork {
  run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T>;
}
```

Repository mutation methods and `AuditWriter.append` accept a `TransactionContext`. The Prisma adapter
implements `UnitOfWork.run` with `prisma.$transaction`, associates the opaque context with the transaction
client, and rejects contexts it did not create. Use cases define the transaction boundary; neither use
cases nor domains know Prisma types.

Reads needed to validate a mutation occur through the same transaction context when consistency matters.
The audit event is appended before the callback completes, so audit failure rolls the business mutation
back and business failure leaves no event.

Alternative considered: expose `Prisma.TransactionClient` as the unit of work. That is simpler but makes
every application port depend on Prisma and defeats the boundary. Alternative considered: emit an event
after commit. That breaks the existing atomic audit guarantee.

### Treat authorization as application policy and scoping as a repository responsibility

Use cases call the pure shared `can()` policy before writes. Repository ports expose actor-scoped reads;
Prisma adapters translate `ActorContext` into organization/grant filters. This preserves the deliberate
distinction between 403 for a forbidden verb and 404 for an unreachable record. Raw unscoped repository
methods are infrastructure-private and cannot be injected into application use cases.

### Preserve HTTP behavior with characterization tests

Before moving a module, its existing HTTP tests become characterization tests for routes, payloads,
statuses, errors, authorization and audit effects. New pure application tests are written first against
ports, observed failing, and then satisfied. During migration, old and new code are never both mounted for
the same route. The route switches at the composition root only when the new adapter passes both suites.

### Migrate in dependency-aware vertical slices

The order is:

1. architecture rules, shared kernel, infrastructure primitives and composition root;
2. identity, authentication, sessions and user profiles;
3. invitations;
4. membership/access grants;
5. clients;
6. projects;
7. campaigns and properties;
8. records and values;
9. audit reads/writes and final unit-of-work consolidation;
10. delete legacy directories and compatibility adapters.

Identity establishes the boundary between token/password adapters and membership-derived actor context.
Invitations and members then establish the business-module pattern on smaller modules. Clients/projects
validate scoping and S3-adjacent operations. Campaigns/records/values follow after repository and
transaction patterns are proven. Audit migrates last because every mutating module consumes it; until
then a compatibility `AuditWriter` adapter delegates to the existing transactional writer.

### Keep identity separate from organization membership

The `identity` module owns registration/login orchestration, password hashing, access and refresh tokens,
session lifecycle and the authenticated user's profile. It exposes a `SessionPrincipal` containing the
stable user identity. The `members` module resolves that principal into the current organization-specific
`ActorContext`, so role changes and suspensions still apply on the next request. Authentication middleware
depends on an identity application port; actor-loading middleware depends on a membership application port.

Invitation redemption is coordinated through an identity-owned port implemented by the invitations
module, avoiding deep cross-module imports. Rate limiting and request metadata stay in shared presentation
infrastructure because they are transport concerns, while bootstrap seed uses identity and membership
application ports from an explicit CLI adapter.

Alternative considered: combine identity and membership. That makes today's single-organization flow
shorter but conflates a login identity with its organization-specific role, recreating the coupling that
the membership model deliberately removed.

## Risks / Trade-offs

- **Temporary duplication between old and new module structures** → Migrate one route family at a time,
  prohibit dual route mounting and delete each legacy slice immediately after parity.
- **Ports mirror Prisma or become generic abstractions** → Review port names against use-case language and
  reject Prisma types from domain/application with the architecture test.
- **A god `UnitOfWork` accumulates every repository** → Pass an opaque transaction context to independent
  ports instead of exposing a registry of repositories.
- **Cross-module cycles appear as features grow** → Require public module surfaces and consumer-owned ports;
  move only genuinely universal concepts into the shared kernel.
- **Authorization regression during repository migration** → Keep integration cases for admin, granted,
  ungranted, guest and client roles around every migrated resource.
- **Audit atomicity regresses during the transition** → Add rollback tests to every mutating use case and
  keep the compatibility audit adapter inside the Prisma unit of work.
- **More files and interfaces slow simple CRUD work** → Use the full layering only at external boundaries;
  keep domain models and use cases as small as their invariants require.
- **Long-running migration conflicts with feature work** → Maintain backward-compatible public module
  contracts and migrate in small commits with a continuously shrinking legacy allow-list.

## Migration Plan

This change does not alter the Prisma schema or migrate data. Existing data survives unchanged.

1. Add architecture tests and the new directories without changing route wiring.
2. Add shared ports and production adapters, covered independently.
3. Migrate identity before invitations and membership so authentication middleware and actor resolution
   have stable application ports for every later module.
4. For each remaining module, characterize current behavior, implement use cases/adapters, switch its routes in the
   composition root, run the complete suite, then remove that module's legacy implementation.
5. Keep compatibility adapters only while downstream modules still depend on legacy audit/storage helpers.
6. Migrate audit last, remove compatibility adapters, empty the architecture-test allow-list and remove all
   obsolete service/controller directories.
7. Run API tests, web tests, production builds and the production Docker build after each migration group.

Rollback is code-only: revert the latest module's route wiring and adapters. No database rollback is
required because schema and stored data do not change.
