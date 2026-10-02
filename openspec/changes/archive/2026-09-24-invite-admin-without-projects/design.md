## Context

`createInviteSchema` requires `projectIds` with `.min(1)` for every `EMPLOYEE` invitation, and
the invite use case repeats the check. Redemption calls `projectAccess.grant` with the
invitation's projects; with an empty list it looks up and inserts nothing.

## Decisions

- **Refuse projects on an admin invitation rather than ignore them.** This matches how a
  `CLIENT` invitation carrying employee fields is already refused, and it keeps an admin's
  access list free of grants that do nothing.
- **The per-role rule lives in the use case.** The schema accepts an optional, possibly empty
  `projectIds`; the use case decides by role. One place states the rule, and the application
  tests cover it without HTTP.
- **The dialog keeps chosen projects when the role switches to admin and back,** but sends none
  while the role is admin. Switching roles back and forth should not lose a selection.

## Migration Plan

No schema change. Existing admin invitations that carry projects stay valid and still grant
those projects on redemption; nothing rewrites them.
