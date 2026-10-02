## Context

`DELETE /api/clients/:id` and `DELETE /api/members/:id` exist and enforce the rules
(see proposal). The web entities already expose `useDeleteClient` and `useDeleteMember`,
unused. The contact book's client card has a header with an edit control behind
`<Can action="update" resource="client">`; the employee card has none. Destructive
actions elsewhere (projects, lead columns) use the shared `ConfirmDialog` and report
failures through `useAlerts().raise`.

## Goals / Non-Goals

**Goals:**
- Delete a client and remove a member from their contact book cards, admin only.

**Non-Goals:**
- Role or status changes in the interface.
- Removing customer staff from a customer's own company team view.

## Decisions

- **Gate with `<Can action="delete" …>`**, the permission matrix the API also uses. For
  `client` it is admin-only. For `member` it also names `CLIENT_ADMIN`, but the employee
  directory is shown only to the agency, so in practice only an admin sees it.
- **A trash icon beside the edit control on the client card; a remove button in the
  employee card header.** Both open `ConfirmDialog` naming the record; the description of
  the client's says its projects and data go too.
- **After deletion, fall back to the first remaining row.** Both directories already show
  the first row when the selected id is missing, so clearing the selection is enough.
- **Failures go through `raise`** with the server's message when there is one, as
  `LeadFilesTab` does; the confirmation closes either way.

## Risks / Trade-offs

- [Deleting a client is irreversible and cascades to projects and metrics] → the
  confirmation states it; only admins see the control.
- [Removing a member cascades to the task images they uploaded] → existing schema
  behaviour, unchanged here.

## Migration Plan

Web-only change; no schema change.
