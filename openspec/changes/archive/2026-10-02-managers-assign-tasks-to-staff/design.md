## Context

`GET /api/members` is guarded by the `member/read` permission, held by `ADMIN` and
`CLIENT_ADMIN`; the web loads the agency staff once (`?kind=staff`) into a shared store
that the task form, task cards and the contact book read. The API's task assignability
check already accepts any active membership of the organization.

## Goals / Non-Goals

**Goals:**
- A manager can pick themselves, an employee or an admin as a task's responsible member.

**Non-Goals:**
- Letting a manager read members' access grants or change anything about a member.
- Narrowing who the API accepts as responsible.

## Decisions

- **Open the staff listing to `MANAGER` in the member use case, not the matrix.** Adding
  `MANAGER` to `member/read` would also open the client-team listing and every future
  read on members. The exception is narrow: `kind=staff` and role `MANAGER`.
- **Filter the picker to active members on the web.** The staff list carries suspended
  members, whom the API refuses; the picker keeps the current responsible member even
  when filtered out, so editing an old task does not silently drop them.

## Risks / Trade-offs

- [Managers now see colleagues' email, phone and Telegram] → the same contact book view
  already intended for them; no customer appears in it.
- [The employee card's access block asks for grants a manager may not read and shows
  none] → existing behaviour for that block, unchanged here.

## Migration Plan

No schema change.
