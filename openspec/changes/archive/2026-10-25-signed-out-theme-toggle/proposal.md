## Why

The colour scheme can only be switched from the app header, so a visitor on the sign-in,
registration or password-reset screen is stuck with the scheme the browser prefers.

## What Changes

- The panel of the sign-in, registration and password-reset screens, and of the suspended
  organization screen, shows the theme toggle at the right of its title, on the title's line.
- `ThemeToggle` moves from `features/theme-toggle` to `shared/ui`, since it holds no business logic
  and the panel lives in `shared`.

## Capabilities

### New Capabilities

- `signed-out-theme`: switching the colour scheme before signing in.

### Modified Capabilities

None.

## Impact

- Web: `shared/ui/ThemeToggle`, `CenteredPanel`, `AppHeader` and `PlatformHeader` imports.
