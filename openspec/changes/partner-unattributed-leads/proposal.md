## Why

A partner sees only the leads that name one of their campaigns. Leads that reach a project
without a campaign, such as quiz leads, imported rows without a campaign and leads the agency
enters by hand, stay with the agency, and nobody passes them to the partners who work the
project's leads. Partners should see these leads next to their own and work them.

## What Changes

- A partner sees the leads of their project that name no campaign, in addition to the leads of
  their campaigns: on the board, in the table and tasks views, in the stage counts, in the
  contacts linked to those leads, in notifications and in live updates.
- A partner edits, moves and adds notes and files to such a lead without it taking a campaign.
  The partner may give it one of their own campaigns, after which partners of other campaigns no
  longer see it.
- Leads of campaigns the partner does not hold stay hidden, as before.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `partner-access`: the partner's CRM board includes the project's leads without a campaign, and
  editing such a lead keeps it without a campaign unless the partner gives it one of theirs.

## Impact

- API: the partner lead scope shared by leads, contacts, stage counts, notifications and live
  updates, and the partner rule for a lead's campaign on update.
- Web: no code change. Partners already see every lead the API returns.
- No data changes.
