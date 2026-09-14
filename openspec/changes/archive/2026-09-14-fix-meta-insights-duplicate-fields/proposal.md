## Why

Live Meta requests reject campaign Insights because campaign_id is emitted twice in the fields parameter. Account and hierarchy requests succeed, but the import fails as INVALID_DATA before any metrics are saved.

## What Changes

- Build a unique field list for each Insights level.
- Add a regression fixture that returns Meta error 2500 for duplicate fields.
- Verify the existing connection completes its intended import.
- No breaking changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This restores the existing meta-project-integration contract; no requirement changes.

## Impact

Graph provider and provider tests only. No schema, credentials or UI changes.
