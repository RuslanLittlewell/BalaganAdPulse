# App Header and Theme Design

## Goal

Add a shared authenticated header with account actions and persistent light/dark theme selection.

## Structure

- `widgets/app-header` composes the account menu and theme toggle.
- `features/auth/ui/user-menu` owns the account dropdown and logout action.
- `features/theme-toggle` owns theme selection UI and persistence.
- `shared/lib/theme` contains DOM and storage helpers so theme initialization can run before React.
- `widgets/app-shell` places the header above the main content while the sidebar spans the viewport.

## Behavior

The first visit follows the operating-system preference. A user selection is stored in
`localStorage`, applied through the `.dark` class on the document root, and exposed with an
accessible toggle. The account trigger uses a generic user placeholder and opens a menu with
Settings and Log out actions. Settings is intentionally a placeholder until a settings route exists.
