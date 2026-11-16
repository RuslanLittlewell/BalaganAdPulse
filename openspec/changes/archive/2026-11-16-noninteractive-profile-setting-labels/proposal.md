## Why

General settings captions look like plain text but currently activate their associated controls when clicked. Their interaction should match their appearance.

## What Changes

- Render the language, theme, Telegram and campaign CRM captions as plain text without label click behavior.
- Preserve accessible control names through aria-labelledby.
- Keep direct control interaction and saving behavior unchanged. No breaking changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `profile-preferences`: General captions do not activate controls.

## Impact

The profile dialog and Telegram section change. Account input labels and the shared Label component remain unchanged.
