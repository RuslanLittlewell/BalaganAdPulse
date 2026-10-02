## Why

The API already lets an admin delete a client and remove a member, but the web interface
offers neither, so an admin has no way to clean up a client entered by mistake or a person
who has left the agency.

## What Changes

- The contact book's client card offers an admin a delete control. It asks for
  confirmation, naming the client and warning that its projects and campaign data go with
  it, then deletes it.
- The contact book's employee card offers an admin a remove control. It asks for
  confirmation, naming the person, then removes their membership from the organization.
- Neither control is shown to any other role. The API rules are unchanged: only an admin
  deletes a client; an admin may not remove their own membership or the last admin.
- A refused or failed deletion is reported to the admin, and nothing is removed.

## Capabilities

### New Capabilities

### Modified Capabilities
- `contact-directory`: an admin deletes a client from the client card.
- `organization-membership`: the employee directory is no longer read-only for an admin;
  it offers removing a member. Role and status changes stay API-only.

## Impact

- `apps/web/src/widgets/contact-book/ClientDirectory.tsx`, `EmployeeDirectory.tsx`.
- `apps/web/src/shared/config/ru.ts` — confirmation and failure copy.
- Reuses the existing `useDeleteClient` and `useDeleteMember` mutations; no API change, no
  schema change.
