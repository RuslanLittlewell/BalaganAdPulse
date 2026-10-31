## Context

The bottom bar made its links `flex-1`. When the navigation is collapsed, `MainNav` and
`PlatformNav` wrap each link in a `WarmTooltip`, whose trigger is an `inline-flex` span; the span
is the row's child and does not grow, so the links shrink to their content and sit at the start
of the bar. `UserMenu` is shared by `AppHeader` and `PlatformHeader`.

## Goals / Non-Goals

**Goals:**
- Modules spread evenly across the bottom bar in both navigation states.
- Only the avatar in the header's user menu on a phone.

**Non-Goals:**
- The rest of the header on a phone.

## Decisions

- **The row stretches its children (`*:flex-1 *:min-w-0`)** rather than each navigation passing
  a class to its tooltip. The rule then lives once, in `Sidebar`, and holds for any wrapper.
  `md:*:flex-none` keeps the side column as it was.
- **The name and email are hidden, not visually hidden, below `md`.** The avatar already carries
  the member's name as its accessible name, so the menu button keeps a name on a phone.
- **No new tests.** Both changes are layout alone; the existing user menu and navigation tests
  guard what they render.
