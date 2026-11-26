## Why

The campaign select in the CRM menu column takes one campaign at a time and lists only running
campaigns. A media buyer who works the leads of a few campaigns at once has to switch between
them, and the leads of a paused or finished campaign cannot be scoped at all.

## What Changes

- The campaign select becomes a multi-select. The member checks one or more campaigns, and the
  CRM shows the leads of all of them. The all campaigns option clears the choice.
- The select lists every campaign of the board's project, running campaigns first, each marked
  as running or stopped.
- The address keeps every chosen campaign as a repeated `campaign` parameter. An address with one
  `campaign` keeps working.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `crm-navigation`: the CRM is scoped to one or more campaigns of any status instead of one
  running campaign.

## Impact

- Web: the campaign select in the CRM menu column, the campaign scope of the CRM page, the board,
  the table and the tasks view, the shared multi-select, which gains an option where an empty
  choice means all.
- No API or data changes.
