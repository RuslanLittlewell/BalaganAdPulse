## Why

Two production projects show lead import as a generic error while Meta refuses every lead request with code 100 and the message "Requires pages_manage_ads or leads_retrieval permission". The spec says a missing lead permission marks lead import as needing access and explains what to grant. The code only recognises codes 10 and 200 to 299, so this refusal is reported as invalid data and the panel gives no hint.

## What Changes

- A Meta refusal with code 100 whose message names a missing permission is classified as a lead access refusal.
- The panel then shows the existing access instructions, and the connection is retried hourly.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `meta-lead-import`: the access refusal also covers code 100 with a permission message.

## Impact

API only: the lead error classification in the Graph provider and its test.
