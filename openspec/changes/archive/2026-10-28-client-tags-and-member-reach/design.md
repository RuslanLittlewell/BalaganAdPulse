## Context

`assertMentionable` refuses every tag from a customer. The comment field builds its offer from
`GET /api/members`, which `CLIENT` may not read and `CLIENT_ADMIN` reads in full, because the
policy lets the principal read members and `list` falls through to the whole organization. The
read-only task form wraps blocks in `<fieldset disabled>`; Radix Select opens on `pointerdown`,
which browsers still deliver to a button disabled by its fieldset.

## Goals / Non-Goals

**Goals:**
- A client tags the people named on the task, by name, without reading the member directory.
- A principal's member list holds their own clients' people only.
- No choice list opens inside a disabled fieldset.

**Non-Goals:**
- Changing whom employees may tag, or how their offer is built.
- Names of people a staff comment tagged who are not on the task, for a client reading it.

## Decisions

- **A task-scoped participants route, not a wider member list.** It answers only people already
  named on a task the caller reaches, with name and picture and no contact details. The
  task's reach decides access, so a client sees nobody new.
- **The server rule mirrors the offer**: a customer's tag must be one of the task's participant
  ids, then passes the existing checks (active, a client's person only on a shared task they
  reach). Self is never offered; tagging oneself stays harmless, as for staff.
- **The participants route sits with the comment use cases**, which already hold the member
  reach port; the port's description gains the member's name and picture.
- **A principal's list is the union of their clients' people lists**, deduplicated, ordered by
  membership age; `kind=staff` narrows it to the agency people among them.
- **The select trigger refuses `pointerdown` while it matches `:disabled`.** This fixes every
  select inside a disabled fieldset in one place instead of threading `disabled` through each
  block; keyboard opening is already impossible on a disabled button.

## Risks / Trade-offs

- [A principal no longer sees names of agency people outside their clients' grants on boards]
  → the same as a `CLIENT` today; task participants they need are on the new route.
