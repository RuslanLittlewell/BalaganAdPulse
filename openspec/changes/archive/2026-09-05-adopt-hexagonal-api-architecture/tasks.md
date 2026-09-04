Every implementation task follows TDD: add the focused failing test, observe it fail, then add the
minimum implementation. Existing HTTP contracts remain characterization tests throughout.

## 1. Architecture boundaries and composition root

- [x] 1.1 Inventory every API source file, its current layer and its target module; commit the legacy allow-list used during migration.
- [x] 1.2 Write the failing architecture tests for inward-only layer imports, public module surfaces, forbidden framework imports and composition-root-only construction.
- [x] 1.3 Implement the import-graph checker and create the `modules`, `shared` and `composition` directory skeletons until the architecture tests pass against the legacy allow-list.
- [x] 1.4 Write the failing app composition tests proving all current routers are mounted once and no endpoint contract changes.
- [x] 1.5 Introduce `create-container.ts` and `create-routes.ts`, moving construction/wiring out of feature modules while retaining current handlers through compatibility factories.
- [x] 1.6 Document the dependency rules and module template in the API architecture section of the README.
- [x] 1.7 Run `npm test`, `npm run test:web`, `npm run build`, `npm run build:web` and the production Docker build — all green.

## 2. Shared kernel and infrastructure primitives

- [x] 2.1 Write failing pure tests for transport-independent `AppError` categories and their mapping to the existing HTTP status/error envelope.
- [x] 2.2 Implement shared domain errors and adapt the Express error middleware without changing responses.
- [x] 2.3 Write failing tests for `ActorContext`, fixed/system clocks and deterministic/random UUID generators.
- [x] 2.4 Implement the actor, `Clock` and `IdGenerator` contracts and infrastructure adapters; keep the role vocabulary sourced from `@adpulse/access-policy`.
- [x] 2.5 Write failing tests for an opaque `TransactionContext` and `UnitOfWork`, including commit, rollback, nested-context rejection and adapter failure.
- [x] 2.6 Implement the Prisma unit-of-work adapter without exposing `Prisma.TransactionClient` to domain or application layers.
- [x] 2.7 Write failing tests proving repositories and an audit writer using one transaction context commit or roll back together.
- [x] 2.8 Add the temporary transactional audit compatibility adapter over the existing audit writer.
- [x] 2.9 Run `npm test` and `npm run test:web` — both green.

## 3. Identity, authentication and user profiles

- [x] 3.1 Extend HTTP characterization tests for register, login, refresh, logout, current session, profile reads/updates, password changes and avatar behavior.
- [x] 3.2 Write failing application tests for registration/login/session and profile use cases using password, token, user, invitation-redemption, clock and unit-of-work ports.
- [x] 3.3 Implement identity domain types, application use cases and focused ports without Express, Zod, Prisma, S3 or process-global imports.
- [x] 3.4 Write failing adapter tests for Prisma users/refresh tokens, password hashing, JWT/opaque tokens and profile storage, including expiry and revocation.
- [x] 3.5 Implement identity Prisma, crypto, token, storage and HTTP adapters and wire them through composition without changing auth/profile contracts.
- [x] 3.6 Write failing middleware composition tests proving authentication resolves a `SessionPrincipal` and membership resolves a fresh `ActorContext` on every request.
- [x] 3.7 Replace legacy auth/user services, controllers and routes; convert bootstrap seed to an explicit CLI adapter and shrink the architecture allow-list.
- [x] 3.8 Run `npm test` and `npm run test:web` — both green.

## 4. Invitations module pilot

- [x] 4.1 Extend invitation HTTP characterization tests to cover every route, response, error, role check, expiry, revocation and redemption behavior before migration.
- [x] 4.2 Write failing application tests for create, list, revoke and redeem invitation use cases using in-memory ports, a fixed clock and deterministic ids.
- [x] 4.3 Implement invitation domain types, use cases and use-case-shaped repository/audit ports with no Express, Zod or Prisma imports.
- [x] 4.4 Write failing adapter tests for the Prisma invitation repository, including organization scoping and transaction participation.
- [x] 4.5 Implement the Prisma invitation adapter and HTTP presentation adapter, keeping Zod in presentation.
- [x] 4.6 Wire the invitation module in the composition root, remove its legacy service/controller/routes and shrink the architecture allow-list.
- [x] 4.7 Run `npm test` and `npm run test:web` — both green.

## 5. Membership and access-grant module

- [x] 5.1 Extend member/access HTTP characterization tests for listing, role/status changes, last-admin protection, removal, grant replacement and immediate authorization effects.
- [x] 5.2 Write failing application tests for member listing, update, removal and grant replacement, including forbidden roles and last-admin conflict.
- [x] 5.3 Implement member/access domain rules, use cases and ports without framework or persistence imports.
- [x] 5.4 Write failing Prisma adapter tests for membership scoping, atomic grant replacement and removal that preserves business data/audit history.
- [x] 5.5 Implement membership/access Prisma and HTTP adapters and wire them through composition.
- [x] 5.6 Remove legacy member files, route all actor loading through the new membership application contract and shrink the architecture allow-list.
- [x] 5.7 Run `npm test` and `npm run test:web` — both green.

## 6. Clients module

- [x] 6.1 Extend client HTTP characterization tests for CRUD, contact-book fields, pictures, role permissions, grant creation and 404 scoping.
- [x] 6.2 Write failing application tests for client create/read/update/delete and picture changes using repository, storage, policy and unit-of-work ports.
- [x] 6.3 Implement client domain/application code and focused ports, preserving contact fields and admin-only deletion.
- [x] 6.4 Write failing Prisma/storage adapter tests for organization ownership, creator grants, scoped lookup, cascades and audit rollback.
- [x] 6.5 Implement client Prisma, S3 and HTTP adapters and wire them through composition.
- [x] 6.6 Remove legacy client service/controller/routes, centralize its scope translation in the adapter and shrink the architecture allow-list.
- [x] 6.7 Run `npm test` and `npm run test:web` — both green.

## 7. Projects module

- [x] 7.1 Extend project HTTP characterization tests for CRUD, priority, picture behavior, role permissions and client/project-grant scoping.
- [x] 7.2 Write failing application tests for project create/list/read/update/delete and picture operations using ports and fixed dependencies.
- [x] 7.3 Implement project domain/application code and focused repository/storage/audit ports.
- [x] 7.4 Write failing Prisma adapter tests for scoped project queries, client membership validation, admin deletion and atomic audit writes.
- [x] 7.5 Implement project Prisma, S3 and HTTP adapters and wire them through composition.
- [x] 7.6 Remove legacy project service/controller/routes and shrink the architecture allow-list.
- [x] 7.7 Run `npm test` and `npm run test:web` — both green.

## 8. Campaigns and properties modules

- [x] 8.1 Extend campaign/property HTTP characterization tests for CRUD, ordering, default properties, formula validation, role permissions and scoped 404 behavior.
- [x] 8.2 Write failing pure domain tests for property types, expression invariants, dependency cycles and computed-column write restrictions.
- [x] 8.3 Move formula expression/evaluation rules into framework-free campaign domain code while preserving numeric-string results.
- [x] 8.4 Write failing application tests for campaign and property use cases, including stored-name audit summaries and transactional rollback.
- [x] 8.5 Implement campaign/property use cases and focused ports without Prisma/Zod/Express imports.
- [x] 8.6 Write failing Prisma adapter tests for campaign/property ordering, formulas, defaults, scoping and audit transaction participation.
- [x] 8.7 Implement campaign/property Prisma and HTTP adapters and wire them through composition.
- [x] 8.8 Remove legacy campaign/property services/controllers/routes and migrated formula files; shrink the architecture allow-list.
- [x] 8.9 Run `npm test` and `npm run test:web` — both green.

## 9. Records and values modules

- [x] 9.1 Extend record/value HTTP characterization tests for dates, uniqueness, single and bulk writes, computed totals, permissions, scoped 404 behavior and response precision.
- [x] 9.2 Write failing pure application/domain tests for record ordering, numeric/text normalization, computed table output and aggregate totals.
- [x] 9.3 Implement framework-free record/value domain calculations and use cases, keeping Prisma decimals inside adapters.
- [x] 9.4 Write failing application tests for record CRUD, single-cell writes and grouped multi-cell writes with exactly one row audit event.
- [x] 9.5 Implement record/value ports and transaction-aware use cases, including atomic bulk validation and audit.
- [x] 9.6 Write failing Prisma adapter tests for date conflicts, value upserts/deletes, row scoping, decimal conversion and rollback.
- [x] 9.7 Implement record/value Prisma and HTTP adapters and wire them through composition.
- [x] 9.8 Remove legacy record/value services/controllers/routes and remaining legacy table-calculation code; shrink the architecture allow-list.
- [x] 9.9 Run `npm test` and `npm run test:web` — both green.

## 10. Audit module and final unit-of-work integration

- [x] 10.1 Extend audit HTTP characterization tests for actor snapshots, summaries, every filter, reach scoping, cursor order and append-only behavior.
- [x] 10.2 Write failing application tests for append and list-audit use cases using actor, clock, repository and transaction ports.
- [x] 10.3 Implement audit domain/application contracts, keeping request metadata as explicit presentation context rather than AsyncLocalStorage access in use cases.
- [x] 10.4 Write failing Prisma audit adapter tests for scoped queries, cursor pagination, snapshot persistence and transaction rollback.
- [x] 10.5 Implement audit Prisma/HTTP adapters and replace the temporary compatibility audit adapter in every migrated module.
- [x] 10.6 Remove legacy audit services/controllers/routes and request-context coupling from application code; shrink the architecture allow-list to empty.
- [x] 10.7 Run `npm test` and `npm run test:web` — both green.

## 11. Legacy removal and architecture acceptance

- [x] 11.1 Write the failing final architecture test that rejects every legacy service/controller directory and any compatibility adapter.
- [x] 11.2 Delete obsolete technical directories, scope helpers and compatibility wiring; expose every module only through its public surface.
- [x] 11.3 Verify no domain/application file imports Express, Zod, Prisma, S3, process globals or another module's private path.
- [x] 11.4 Update README architecture diagrams, module-creation guidance, transaction rules and test strategy as finished reference documentation.
- [x] 11.5 Run `openspec validate adopt-hexagonal-api-architecture --strict`.
- [x] 11.6 Run `npm test`, `npm run test:web`, `npm run build`, `npm run build:web` and `docker build -f apps/api/Dockerfile.prod .` — all green.
