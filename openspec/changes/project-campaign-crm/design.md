## Context

`useCampaignScope` in the CRM menu widget reads the member's CRM by campaign preference from
`localStorage` through `useCampaignCrm`, and the CRM menu, the CRM page and the integrations window
all go through it. The boards list (`GET /api/crm/boards`) returns each reachable project as a
board with its client and the member's lead capabilities. Board columns are managed by members
with `update` on `lead-board`. The CRM header shows the Интеграции button only inside the CRM.

## Goals / Non-Goals

**Goals:**

- One CRM by campaign setting per project, shared by its members.
- Change it in one click from the CRM header, where the campaign select it controls is visible.

**Non-Goals:**

- Carrying members' browser preferences over to projects.
- Enforcing campaign scope on the server; the setting only shapes the interface, as before.

## Decisions

- The setting is a `campaign_crm` boolean on `project`, default false. A table of project
  settings was considered and rejected for one flag.
- The boards list carries `campaignCrm` for each board, so the CRM reads the setting with the
  board it already loads and needs no second request.
- `PATCH /api/crm/boards/:boardKey` with `{ campaignCrm }` changes it. It needs `update` on
  `lead-board`, the permission for a board's columns, because the setting changes how the board is
  laid out for everyone. An unreachable board answers 404. The change is audited on the project.
- The change is announced as `crm.changed` with a new `boards` resource, and open CRM pages of
  that board reload the boards list, so other members see the select appear or go without
  reloading.
- `useCampaignScope` takes the board instead of its key and reads `board.campaignCrm`. Its callers
  already hold the board from `useSelectedBoard`.
- The switch is a widget beside the integrations button in the CRM menu widget slice, rendered by
  the header next to `IntegrationsButton`. It updates the boards query optimistically and rolls
  back with an alert when the request fails.
- The profile switch, `useCampaignCrm` and the `localStorage` preference are removed. Old values
  stay in members' browsers unread.

## Migration

One migration adds `campaign_crm BOOLEAN NOT NULL DEFAULT false` to `project`. Every project keeps
its data and starts with the setting off. The running version does not read the column, so it
keeps working between the migration and the replacement.

## Risks / Trade-offs

- [Members who used the profile switch lose the campaign select until a manager turns the project
  on] → The release note says where the switch moved.
- [A manager turns the setting off while a colleague works by campaign] → The colleague's checked
  campaigns stay in the address and apply again when the setting is turned back on; the audit
  trail shows who changed it.
