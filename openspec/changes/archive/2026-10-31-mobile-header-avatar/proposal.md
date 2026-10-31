## Why

On a phone the header's user menu shows the member's name and email beside the avatar, taking
room the header does not have. The bottom navigation also packs its modules to the left for a
member who collapsed the navigation on a laptop, instead of spreading them across the bar.

## What Changes

- Below 768 px the user menu in the header shows only the avatar; the name, the email and the
  chevron appear from 768 px.
- The bottom navigation spreads its modules evenly across the bar whether or not the navigation
  was collapsed on a wide screen.

## Capabilities

### New Capabilities

### Modified Capabilities
- `mobile-layout`: the bottom bar shares its width evenly, and the header shows only the avatar.

## Impact

- `apps/web/src/features/auth/ui/user-menu/UserMenu.tsx`: name, email and chevron from `md`.
- `apps/web/src/shared/ui/Sidebar/Sidebar.tsx`: the navigation row stretches each of its
  children, tooltip wrappers included.
