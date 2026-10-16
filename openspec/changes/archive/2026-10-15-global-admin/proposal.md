## Why

AdPulse runs as one instance serving a single organization, Balagan. It is to become a
SaaS where organizations are added with a tariff that decides which modules they get.
Before webhooks and automatic provisioning exist, the owner needs a place to add
organizations by hand and to see every organization using the instance.

## What Changes

- Add a platform administrator: an account that belongs to no organization and reaches
  only the platform administration. There is exactly one, created by a seed command from
  environment variables (`global-admin@balagan.pro`); its password is never committed.
- Add the platform administration, a separate area of the web app with one module,
  "Организации": a table of every organization on the instance, and a form that adds one.
- Adding an organization takes a name, the optional modules it is entitled to and the
  email of its first administrator. It creates the organization and an `ADMIN`
  invitation for that email; the registration link is shown to the platform
  administrator to hand over.
- The platform administrator can edit an organization — rename it, add or remove optional
  modules — and suspend or reactivate it, so that access can be stopped when a tariff is
  not paid. A suspended organization's members are refused on every request; its data is
  kept untouched.
- Give every organization a set of enabled modules. Dashboard and Projects are always on;
  CRM, Tasks and Reports are optional. The set is enforced: a disabled module is absent
  from the organization's navigation and its API answers 404.
- **BREAKING**: `GET /api/auth/me` gains `platformAdmin` and, for members, the
  organization's `modules`; the web client depends on them.
- Existing organizations (Balagan) keep CRM, Tasks and Reports on through the migration.

## Capabilities

### New Capabilities

- `platform-administration`: the platform administrator, the organization table, the
  creation of an organization with its first-admin invitation, and editing, suspending
  and reactivating an organization.
- `organization-modules`: the per-organization module set, its enforcement in the API
  and the navigation, and changing it after creation.

### Modified Capabilities

- `organization-membership`: an account may be a platform administrator without any
  membership, which is not refused as "no membership" but confined to the platform area;
  members of a suspended organization are refused.

## Impact

- Prisma: `User.isPlatformAdmin`, `Organization.modules`, `Organization.status`, new
  `OrgModule` and `OrgStatus` enums; one migration, existing rows keep every optional
  module and stay active.
- API: new `platform` module mounted at `/api/platform` (list, create, update);
  suspended organizations refused at actor resolution, in invitation redemption and on
  realtime connections; a module guard on the CRM,
  Tasks, task-images and Reports routes; `/api/auth/me` response; a platform-admin seed.
- Web: a platform shell and an organizations page; navigation and route filtering by
  enabled modules; Russian copy in `ru.ts`.
- Deployment: `SEED_PLATFORM_ADMIN_EMAIL` and `SEED_PLATFORM_ADMIN_PASSWORD` set on the
  server and in local `.env`, then the seed run once.
