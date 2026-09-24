## Why

The task module shows every task the member is allowed to see, all at once. For an admin,
whose board carries the whole organization's work, that is a wall of cards in which one
person's queue cannot be picked out. The question asked of the board most often — "what is
this person on right now" — has no answer short of reading every card.

## What Changes

- The task module's header carries a filter by responsible member: a multi-select listing
  people with their avatars, beside the module title.
- Choosing nobody means the module shows everything, as it does today. Choosing one or more
  people narrows the module to their work.
- The filter lists the people who are responsible for tasks the member can already see,
  rather than the organization's staff: the list answers "whose work is on this board".
- An **Не назначен** entry sits alongside the people, offered while a task nobody is
  responsible for is visible, so unclaimed work can be picked out.
- The filter narrows both the board and the calendar, because it belongs to the module
  rather than to one of its views. Switching between the two keeps it.
- The choice is remembered per member across sessions, the way the Канбан/Календарь choice
  already is.

## Capabilities

### New Capabilities

### Modified Capabilities
- `task-board`: the module gains a filter by responsible member — what it lists, what
  choosing nothing means, that it narrows what reach and the own-work rule already allow and
  can never widen it, that it covers both views, and that the choice outlives the session.

## Impact

- **Web** (`apps/web`): a new multi-select control under `src/shared/ui/`, composed from the
  vendored `DropdownMenuCheckboxItem` and the existing `MemberAvatar`; `TasksPage` gains the
  control in its header and narrows the array it hands to `TaskBoard` and `TaskCalendar`;
  `src/shared/lib/moduleMemory.ts` gains a per-user map of chosen assignee ids; `ru.ts` gains
  the strings the control reads.
- **API**: none. The module already loads every reachable task in one request, so the filter
  narrows what is in hand rather than asking the server again.
- **Data**: none.
