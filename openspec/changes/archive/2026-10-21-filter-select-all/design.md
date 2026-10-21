## Context

Both filters are the shared multi-select. An empty choice already means "no narrowing", so
choosing every entry shows the same tasks as choosing none; the **Все** entry is a shortcut
to the full set and a way to see that the full set is chosen.

## Goals / Non-Goals

**Goals:**

- One entry per filter that chooses or clears the whole list.

**Non-Goals:**

- Changing what an empty choice means, or how the choice is remembered.
- Adding **Все** to the multi-selects of the task and project forms, where choosing everyone
  is rarely meant.

## Decisions

- The multi-select takes an optional label for the entry; without it nothing changes, so the
  forms keep their lists. The entry reports through the same change callback as any other,
  with all values or none, so the pages need no new handler.
- **Все** is derived from the choice (every item chosen), not stored, so it cannot drift from
  the entries.
