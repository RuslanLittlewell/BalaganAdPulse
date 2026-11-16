## Context

The web app uses a typed Russian dictionary through t(). Some translated labels are created at module initialization. ProfileSettingsDialog already handles account editing and embeds TelegramBotSection. Tabs wraps the existing RubberSegment control.

## Goals / Non-Goals

Provide two profile tabs and browser preferences without changing identity or Telegram APIs. Retain existing profile behavior. Campaign CRM implementation and preference synchronization between devices are outside this change.

## Decisions

- Reuse Tabs and shared form controls, with Tailwind for layout. Keep account fields mounted while switching tabs so drafts and validation remain intact.
- Add a complete typed English dictionary. Keep the Russian key type as the translation contract. Reload after saving a changed language so labels created at module initialization also change. A reactive context alone would leave those labels stale.
- Store language as a browser setting and campaign CRM under a key containing the authenticated user ID, following existing browser preferences. Persist only on Save. A database-backed preference endpoint is unnecessary for this browser-only behavior.
- General saves independently of account form validation. Telegram retains its existing immediate actions on Account.

## Risks / Trade-offs

- Language changes reload the page and discard unsaved edits in other views. The language selector explains that the page reloads on save.
- Browser storage can be unavailable. Preference reads use defaults and save failures are surfaced through the existing alert system.
- Translations can drift. Compile-time dictionary completeness and tests enforce key parity.

## Migration Plan

No schema or API migration is needed. Existing profile data survives unchanged. Deploy the web build; rollback restores the previous dialog and ignores the new browser preference keys.
