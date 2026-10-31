## Why

On a phone the app keeps its desktop frame: wide margins, a side column of navigation that
takes a third of the screen, and a toggle to collapse it. Little room is left for the content,
and the navigation sits where a thumb does not reach.

## What Changes

- Below 768 px the app's frame uses narrow margins and gaps and fits the visible height of the
  screen.
- There the navigation becomes a bar at the bottom: one row of modules, each an icon over its
  name, without the brand, the section heading or the collapse toggle.
- From 768 px the navigation stays the collapsible side column it is today.

## Capabilities

### New Capabilities
- `mobile-layout`: how the app's frame and navigation adapt to a narrow screen.

### Modified Capabilities

## Impact

- `apps/web/src/widgets/app-shell/AppShell.tsx`: frame spacing, order and height on a narrow screen.
- `apps/web/src/shared/ui/Sidebar/Sidebar.tsx`: the responsive navigation classes, shared by
  both navigations.
- `apps/web/src/widgets/main-nav`, `apps/web/src/widgets/platform-nav`: use them.
