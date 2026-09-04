## Why

The Team section is a second place to look at the people in the organization. The
contact book already has an Employees pane that lists them with their name, email and
role, and it is where invitations are issued — so opening the app to find a colleague
means choosing between two screens that answer the same question.

## What Changes

- The Team section leaves the interface: its navigation entry, its route and its page.
- `/team` redirects to the dashboard, so a bookmark does not land on nothing.
- **BREAKING for operators**: changing a member's role, suspending or reactivating them,
  and removing them from the organization have no interface. The API keeps all three, and
  the contact book keeps listing members read-only.

## Capabilities

### Modified Capabilities

- `organization-membership`: member administration is no longer reachable from the
  interface; the directory that remains is read-only.

## Impact

- `apps/web`: the team page, its route and navigation entry, its tests, and the strings
  only it used.
- `apps/api`: untouched. Every member endpoint and its rules stay exactly as they are.
