## Why

Every organization today gets a hand-picked set of modules and no limits. The product
needs priced plans (Solo, Business, Agency, Agency Pro, Enterprise) and a trial, so the
platform administrator can sell by plan and the app can hold an organization to what its
plan includes.

## What Changes

- Add a tariff to each organization: `TRIAL`, `SOLO`, `BUSINESS`, `AGENCY`, `AGENCY_PRO` or `ENTERPRISE`. The platform administrator assigns it by hand. Payment stays outside the system.
- A new organization starts on `TRIAL`: 14 days with Agency limits and modules. After the trial ends the organization is read-only until the administrator assigns a tariff.
- Each tariff fixes limits on projects, clients, users and ad accounts. Creating a record over the limit answers 403 with a clear message.
- Each tariff fixes the optional modules: Solo has none, Business has CRM, Agency and above have CRM, Tasks and Reports.
- **BREAKING**: the module list is no longer set by hand. It derives from the tariff, so `POST` and `PATCH /api/platform/organizations` take a tariff in place of `modules`.
- Existing organizations move to `ENTERPRISE`, so they keep every module and have no limits.
- The session reports the tariff, its limits, current usage and the trial end date. The web app shows them to administrators and shows a banner while the trial runs or after it ends.
- White-label, API access and support appear only as text in the plan description. No code backs them.

## Capabilities

### New Capabilities
- `account-tariffs`: the tariff catalogue, trial lifecycle, limits and their enforcement, read-only state after the trial.

### Modified Capabilities
- `organization-modules`: modules derive from the tariff instead of a stored hand-picked list.
- `platform-administration`: creating and editing an organization takes a tariff; the list shows tariff and trial end.

## Impact

- Prisma: `Organization` gains `tariff` and `trialEndsAt`; the `modules` column is dropped after a data migration.
- API: `platform`, `identity` (`/api/auth/me`), `projects`, `clients`, `invites`, `members`, `integrations` services check limits; one guard blocks writes after the trial.
- Web: platform organization form and table, a tariff and usage view for administrators, a trial banner, Russian copy in `ru.ts`.
- OpenAPI documents the new fields and the 403 limit error.
