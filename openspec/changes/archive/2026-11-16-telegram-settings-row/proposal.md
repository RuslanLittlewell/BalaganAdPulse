## Why

Telegram settings should use the same horizontal layout as the other General preferences.

## What Changes

- Put the Telegram bot heading on the left.
- Align the connected indicator, username, notification switch and Disconnect button on the right, in that order.
- Remove the card border, padding and decorative icon.
- Preserve existing Telegram actions and accessible labels. No breaking changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. Only the layout of the existing controls changes.

## Impact

The shared TelegramBotSection component and its placement in the General settings row group change. No API, storage or dependency changes are needed.
