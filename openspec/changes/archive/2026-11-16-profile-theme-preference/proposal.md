## Why

Members should be able to choose the application's color scheme alongside their other General preferences.

## What Changes

- Add a Light / Dark select to General in the existing settings-row style.
- Apply and persist the selected theme when Save succeeds.
- Keep the existing header theme button synchronized with changes made in settings.
- Preserve language, Telegram, campaign CRM and account behavior. No breaking changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `profile-preferences`: Theme selection from General.

## Impact

The profile dialog, translation dictionaries and shared theme toggle subscription change. Existing browser theme storage is reused without an API or database migration.
