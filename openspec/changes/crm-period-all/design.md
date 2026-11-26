## Context

The CRM period is a filter `arrival between [from, to]` stored in the member's view of the board.
A view that was never saved starts with the current month. Clearing both fields already drops the
filter and saves the view without it, so every lead is shown, but the control offers no button
for it.

## Goals / Non-Goals

**Goals:**

- Give the CRM period a one-click way to show leads of any arrival date.

**Non-Goals:**

- Other presets such as last month or last 30 days.
- Changing the dashboard's period control.

## Decisions

- The button Все drops the period filter through the same path as clearing both fields, so the
  saved view holds no period and the choice survives a reload. Saving an explicit "all" marker was
  rejected: an absent period already means all once the view is saved.
- The button sits before the From field and follows the dashboard's period presets: a small
  button, secondary while pressed and ghost otherwise, with `aria-pressed`.
- Pressing Все while it is already pressed changes nothing.

## Risks / Trade-offs

- A member who pressed Все keeps seeing every lead on later visits until they pick a period. This
  matches how the rest of the view is remembered.
