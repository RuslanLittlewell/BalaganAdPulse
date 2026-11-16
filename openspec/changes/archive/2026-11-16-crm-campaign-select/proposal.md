## Why

Members who turn on "CRM by campaign" in profile settings expect it to change the CRM. Today the switch stores a flag and nothing reads it. A media buyer who runs several campaigns in one project cannot see the leads of one campaign without building a filter.

## What Changes

- With the switch on, the CRM menu column shows a second select under the board picker. It lists the campaigns of the selected project.
- Choosing a campaign limits the leads, the board, the table, the tasks view and the lead count to that campaign. A first option clears the choice.
- The choice lives in the address as `campaign`, so reloading keeps it. Changing the board clears it.
- With the switch off, the CRM looks and behaves as before.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `crm-navigation`: the menu column gains the campaign select and the campaign scope.
- `profile-preferences`: the campaign CRM switch now enables that select.

## Impact

Web only: `CrmNav`, `CrmPage`, the lead view helpers and the profile preference hook. No API or database change.
