## Context

See `proposal.md`. `consolidate-contact-book-invitations` moved invitations out of the
Team page into the contact book, leaving the Team page holding member administration
alone. The contact book's employee pane already lists members read-only.

## Goals / Non-Goals

**Goals**

- One place to look at members.
- No dead route, and no bookmark that lands on a blank screen.

**Non-Goals**

- Removing or weakening any member endpoint. The rules are enforced server-side and stay
  exactly as they are.
- Moving member administration into the contact book. That is a decision about where it
  belongs, not about whether the Team page duplicates a directory — and it can be made
  later, against a smaller surface.

## Decisions

### `/team` redirects rather than 404s

To the dashboard, following the redirect `/clients/*` already has to `/projects`. A route
that simply disappears renders the shell with an empty pane, which reads as a page that
failed rather than one that moved.

### The member entity's write hooks stay

`useUpdateMember` and `useDeleteMember` lose their only caller. They are kept because they
are the entity's binding to endpoints that still exist and still work, and they are
covered by their own tests — deleting them would throw away tested bindings to a live
API to tidy up an unused import. `role.*` labels stay for the same reason: the contact
book and the invitation form both use them.

`team.role` also stays, because the employee directory labels its role row with it. Its
key now names a section that is gone, which is untidy; renaming it would touch a file
this change has no other reason to open, so it is left and noted.

### What actually leaves

The page, its route, its navigation entry, its tests, and the strings nothing else uses:
the section's title and description, the suspend and activate labels, its empty and
failure messages, the removal confirmation, the member status labels and the permission
refusal it showed.

## Risks / Trade-offs

- [No interface for changing a role, suspending a member, or removing one] → Stated in
  the proposal as breaking for operators. Those changes are made through the API until an
  interface for them is decided on. This is the point of the change, not a side effect.
- [An operator looks for the section and cannot find it] → The contact book's employee
  pane is where members are, and the navigation no longer offers a second answer.

## Migration Plan

No data and no schema. Deploying is enough; `/team` starts redirecting the moment the
new bundle loads.
