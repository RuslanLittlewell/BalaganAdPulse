## Why

The agency wants partners to work only their leads for now and not to see the project's
advertising figures. The projects module has to disappear from the partner's interface for a
while, without taking away what the CRM needs.

## What Changes

- A partner whose organization has the CRM module no longer sees Проекты in the menu, lands on
  the CRM after signing in, and is sent to the CRM from any project or campaign page address.
- A partner whose organization has no CRM module keeps the project page as before, so they are
  not left without a section.
- The API is unchanged: the CRM of a partner still reads the names of their campaigns from the
  project.
- The change is meant to be reverted later by a change that restores the previous requirement.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `partner-access`: the partner's menu and landing page leave out the project while the
  organization has the CRM module.

## Impact

- Web: the partner's home route, the projects routes for a partner and the main menu.
- No API or data changes.
