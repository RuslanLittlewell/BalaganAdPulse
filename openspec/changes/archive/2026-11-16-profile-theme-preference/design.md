## Context

The app already stores light and dark themes in adpulse.theme and applies them through a shared helper. General has a local draft for its language and campaign CRM choices. The header theme toggle currently owns an isolated theme state.

## Goals / Non-Goals

Add a theme select alongside language using existing components and browser theme storage. Additional color palettes and account-level theme storage are outside this change.

## Decisions

- Keep the theme selection as a local draft, initialize it when opening and apply it through the existing setTheme helper on Save.
- Reuse the shared Select and existing Tailwind row and label styles, with Russian and English option labels.
- Add a preferred-theme subscription using the existing theme observer. Use it in ThemeToggle so changes made in settings update the header's icon and accessible name. Reading the preferred theme preserves the existing system-preference behavior when a toggle is rendered independently.

## Risks / Trade-offs

The header and General share one browser theme setting. Subscribing the header avoids a stale action after saving from General. Unsaved selections deliberately do not change the active theme.

## Migration Plan

No migration is required. Existing saved themes continue to work through the same storage key.
