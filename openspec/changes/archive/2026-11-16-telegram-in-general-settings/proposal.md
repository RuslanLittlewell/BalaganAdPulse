## Why

Telegram bot connection belongs with the application's general preferences rather than personal account fields.

## What Changes

- Move Telegram bot connection, disconnection and notification controls from Account to General.
- Preserve the existing integration behavior and account fields.
- No breaking changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `profile-preferences`: General contains the Telegram integration.

## Impact

The profile dialog, its Telegram behavior tests and the profile preferences specification change. No API or storage changes are needed.
