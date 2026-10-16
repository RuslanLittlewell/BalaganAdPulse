## 1. Data model and shared module list

- [x] 1.1 Add `OrgModule` enum, `Organization.modules` (default all three) and `User.isPlatformAdmin` to `apps/api/prisma/models/`, and generate the migration; confirm locally that an existing organization keeps all three modules.
- [x] 1.1a Add the `OrgStatus` enum and `Organization.status` (default `ACTIVE`) in the same migration; confirm existing organizations stay active.
- [x] 1.2 Add `ModuleKey` and the always-on/optional split to `packages/access-policy` and rebuild it.
- [x] 1.3 Carry the organization's modules and the user's platform flag through the identity and member ports that build the session.
- [x] 1.4 Cover the shared module list with a package test; run `npm test` until green.

## 2. Platform administrator

- [x] 2.1 Add `seedPlatformAdmin` and the `seed:platform` script to `apps/api`, reading `SEED_PLATFORM_ADMIN_EMAIL` and `SEED_PLATFORM_ADMIN_PASSWORD`, idempotent, with the eight-character check; document the variables in both `.env.example` files, `README.md` and `deploy/`.
- [x] 2.2 Add `requirePlatformAdmin` and mount `/api/platform` before actor resolution in `create-routes.ts` and the container wiring.
- [x] 2.3 Return `platformAdmin` and `modules` from `GET /api/auth/me`; a platform administrator gets no organization.
- [x] 2.4 Cover the seed (first run, rerun, missing variables, short password), the guard (401, 403 for members, 200 for the administrator) and `/me` for both kinds of account; run `npm test` until green.

## 3. Organizations API

- [x] 3.1 Create the `platform` API module (domain, application ports and use cases, Prisma infrastructure, HTTP, Zod schemas, OpenAPI) with `GET` and `POST /api/platform/organizations`.
- [x] 3.2 Implement creation in one transaction: organization with unique slug, then the email-bound `ADMIN` invite with no creator; refuse an email that already holds a membership (409) and invalid modules or email (400).
- [x] 3.3 Implement the listing with active member count and the first-administrator state.
- [x] 3.4 Cover creation (modules stored, invite created, redemption enrols an admin of the new organization only, slug collision, validation, conflict) and the listing (existing organization, fresh one); run `npm test` until green.

- [x] 3.5 Add `PATCH /api/platform/organizations/:id` (name, modules, status) with validation, 404 for an unknown id and an immutable slug; cover rename, adding and removing modules (data kept and restored), invalid input, unknown id and refusal of non-platform callers; run `npm test` until green.

## 4. Module enforcement in the API

- [x] 4.1 Add `requireModule` and mount it on `/api/crm`, `/api/tasks`, `/api/task-images`, `/api/reports` and `/api/projects/:projectId/reports`, answering 404.
- [x] 4.2 Hide summary-tile and overview data that belongs to a disabled module.
- [x] 4.3 Cover each guarded group for an organization without the module, an organization with it, and two organizations side by side; run `npm test` until green.

## 4a. Suspension

- [x] 4a.1 Refuse members of a suspended organization at actor resolution with 403 "Organization is suspended"; keep `GET /api/auth/me` answering with `status: "SUSPENDED"` and no modules for them.
- [x] 4a.2 Refuse invitation redemption into a suspended organization and stop delivering realtime events to its members.
- [x] 4a.3 Cover immediate effect on a held token, other organizations unaffected, data intact after reactivation, `/me` for a suspended member, a refused registration and a silent realtime connection; run `npm test` until green.

## 5. Platform area in the web app

- [x] 5.1 Add the `organization` entity (types, API client, query keys) and the `organization-admin` feature: table, add-organization dialog with module checkboxes (Dashboard and Projects locked), and the copyable registration link; copy in `ru.ts`; buttons rendered by the components that show them.
- [x] 5.1a Add the status column, the edit dialog (name, module checkboxes with Dashboard and Projects locked) and a suspend/reactivate action with a confirmation, each rendering its own buttons; copy in `ru.ts`.
- [x] 5.1b Show a "Доступ приостановлен" screen with only a sign-out action when the session reports a suspended organization.
- [x] 5.2 Add `PlatformShell` with a single "Организации" navigation item and route the platform administrator to it, redirecting every other path.
- [x] 5.3 Filter `MainNav` and routes by the session's `modules`, redirecting a disabled route to the dashboard.
- [x] 5.4 Cover the table with its status, the create and edit dialogs (fields, locked modules, validation, link shown), the suspension confirmation, the suspended screen, the platform shell and the navigation filtering by text, roles and `aria` state, never styles; run `npm run test:web` until green.

## 6. Rollout

- [x] 6.1 Apply the migration and the seed locally with `docker compose restart api`, and check the platform sign-in, adding an organization, registering its first admin and the disabled-module behavior in the browser.
- [x] 6.2 Run `openspec validate global-admin --strict`, `npm test` and `npm run test:web`, then archive the change.
