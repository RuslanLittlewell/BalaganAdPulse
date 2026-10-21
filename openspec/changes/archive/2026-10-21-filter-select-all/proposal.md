## Why

The participant and project filters of the tasks screen are multi-selects: to see every
participant or every project in the list, each entry has to be ticked one by one. There is no
single choice that means "all of them".

## What Changes

- Each of the two filters, participants and projects, gets its own **Все** entry at the top of
  its list. Choosing it chooses every entry of that filter; choosing it again clears the filter.
  It is marked while every entry of its own filter is chosen.
- The two entries are independent: **Все** in one filter does not touch the other.
- The multi-selects in the task and project forms are unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `task-board`: the participant and project filters offer a **Все** entry.

## Impact

- Web: `shared/ui` multi-select (an optional "all" entry), `pages/tasks` (turns it on for both
  filters), the Russian copy.
