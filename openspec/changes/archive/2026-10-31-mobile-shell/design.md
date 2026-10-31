## Context

`AppShell` places the navigation (`MainNav` or `PlatformNav`, both built on the shared `Sidebar`)
in a side column with a collapse toggle, inside a `p-8 gap-6` frame of `h-screen`. Both
navigations repeat the same link classes.

## Goals / Non-Goals

**Goals:**
- A phone layout with the navigation at the bottom, not collapsible.

**Non-Goals:**
- Adapting the header, the project list column or individual pages; they follow separately.

## Decisions

- **One navigation, laid out by breakpoint.** Rendering a second, mobile-only navigation would
  put every link in the document twice, which assistive technology and the tests would both
  meet. The same `nav` switches between a row and a column with `md:` classes.
- **`md` (768 px) as the boundary**, the breakpoint the app already uses for its two-column
  layouts.
- **The collapsed state only applies from `md`.** Its classes are all `md:`-prefixed, so a
  choice made on a laptop does not hide the names on a phone; the toggle is `hidden md:grid`.
- **The navigation classes move into `Sidebar`** as small helpers used by both navigations, so
  the responsive rules exist once.
- **`h-dvh` instead of `h-screen`**, so mobile browser bars do not push the bottom bar out of
  view; on a desktop both are the same.
- **No new tests.** The change is layout alone, which the project does not test; the existing
  navigation and shell tests guard that names, links and the toggle stay as they were.

## Risks / Trade-offs

- [Six modules on a 320 px screen leave about 50 px per tab] → names are short and truncate; the
  row scrolls sideways if it ever overflows.
