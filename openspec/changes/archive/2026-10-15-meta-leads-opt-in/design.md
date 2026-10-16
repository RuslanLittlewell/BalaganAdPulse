## Context

`ProjectIntegration.leadsEnabled` defaults to `true` in the schema, the create use case
falls back to `true`, and the connection window starts the switch on. The web app knows the
organization's modules from the session (`useModuleEnabled`).

## Goals / Non-Goals

**Goals:** opt-in lead import, the switch only with CRM, instructions next to it.

**Non-Goals:** stopping polls of existing connections when CRM is switched off later; the
API refusing `leadsEnabled: true` without CRM — leads are kept like any data of a disabled
module and return with it.

## Decisions

- **Default `false` in all three places**: the window, the use case fallback and the column
  default, so no path creates a polling connection by accident. The migration only changes
  the column default; existing rows keep their value.
- **Hidden, not disabled, without CRM**: a switch for a module the organization does not
  have would only raise questions. A connection created without CRM is created off.
- **Instructions in a popover** opened by an "i" icon button with an accessible name,
  closing on an outside click or Escape like any popover; the steps name the token
  permissions the poller needs (the same ones its access error lists), page access, and the
  Leads Access Manager.

## Migration Plan

`ALTER TABLE "project_integration" ALTER COLUMN "leads_enabled" SET DEFAULT false;` — data
survives untouched; rollback sets the default back to `true`.
