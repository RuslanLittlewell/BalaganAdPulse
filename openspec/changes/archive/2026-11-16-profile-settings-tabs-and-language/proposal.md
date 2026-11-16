## Why

Profile settings mix personal details and Telegram controls in one form. Members need a clear place to choose their interface language and keep a preference for the planned campaign CRM feature.

## What Changes

- Split the profile dialog into General and Account using the existing Tabs component.
- Add Russian and English interface dictionaries and a language selector.
- Save browser preferences for language and the future campaign CRM switch, with the CRM preference scoped to the signed-in user.
- Keep profile editing, avatar editing, password changes and Telegram linking in Account.
- The campaign CRM switch records a preference only; campaign CRM behavior is outside this change.
- No breaking API changes.

## Capabilities

### New Capabilities

- `profile-preferences`: Profile tabs, interface language and the campaign CRM preference.

### Modified Capabilities

None.

## Impact

The web profile dialog, shared translation configuration and locale-aware UI formatting change. Preferences are stored in this browser, without a database migration or new API endpoint. Existing Telegram APIs and profile fields remain available.
