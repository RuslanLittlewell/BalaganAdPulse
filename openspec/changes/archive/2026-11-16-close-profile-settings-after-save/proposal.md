## Why

Saving profile settings leaves the dialog open, requiring a second action to return to the app. A successful save should finish the interaction.

## What Changes

- Close profile settings after a successful Save on General or Account.
- Keep the dialog open on validation, storage or API errors and while a request is pending.
- Preserve notifications and the language-change reload.
- No breaking changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `profile-preferences`: Close the dialog after saving settings successfully.

## Impact

The profile dialog and its behavior tests change. No API, storage or dependency changes are needed.
