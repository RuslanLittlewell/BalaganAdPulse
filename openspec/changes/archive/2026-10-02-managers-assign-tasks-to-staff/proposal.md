## Why

A manager creating a task cannot choose who is responsible for it: the responsible-member
picker is filled from the agency's staff list, which the API answers only to admins, so a
manager sees an empty picker and cannot even assign the task to themselves. The API
already accepts any active member of the organization as responsible.

## What Changes

- A `MANAGER` may list the agency's staff (`GET /api/members?kind=staff`): admins,
  managers and guests of their organization, never customers. Every other member listing
  stays admin-only, and so do role, status, access and removal changes.
- The task form's responsible-member picker offers active agency staff only — the manager
  themselves, other employees and admins — and never a suspended member, whom the API
  would refuse. A task already assigned to someone no longer offered keeps showing them.
- The contact book's employee directory, already visible to managers, now lists their
  colleagues for them instead of staying empty.

## Capabilities

### New Capabilities

### Modified Capabilities
- `organization-membership`: managers may list the agency's staff.
- `task-board`: the responsible-member picker offers active agency staff.

## Impact

- `apps/api/src/modules/members/application/member-use-cases.ts` — list permission.
- `apps/web/src/features/task-management/ui/TaskFormDialog.tsx` — picker options.
- No schema change.
