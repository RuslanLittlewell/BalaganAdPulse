## Why

The CRM opens on the leads that arrived in the current month. To see every lead of a board, a
member has to clear both period fields by hand, and nothing on screen says that this is how to
get there.

## What Changes

- The arrival period in the CRM header gains a button Все before the From field. It removes the
  period, so the board, the table and the tasks view show leads of any arrival date, and it shows
  as pressed while no period applies.
- Picking a date in either field releases the button, and the period applies again once both
  fields hold dates.
- The arrival period, which the specs did not describe yet, is written down: it starts on the
  current month and is remembered with the rest of the member's view of the board.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `crm-board-view`: a new requirement for the arrival period of the CRM header, with the button
  Все.

## Impact

- Web: the CRM period control and its Russian and English copy.
- No API or data changes.
