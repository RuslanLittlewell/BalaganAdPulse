## Context

`ProjectList` keeps a `priorityFilter` state; `shown(id)` filters pinned ids, top-level
items and group contents, and `arrangeable` (no filter) gates dragging. Rows show the
client name from the clients query.

## Goals / Non-Goals

**Goals:**
- Replace the filter with a debounced, client-side search over project and client names.

**Non-Goals:**
- Server-side search; the whole list is already loaded.
- Persisting the search across visits.

## Decisions

- **`useDebouncedValue(value, delay)` in `shared/lib`.** The input stays controlled and
  instant; the list reads the debounced value, 300 ms. A shared hook rather than a local
  timer, since no debounce helper exists yet and it is generic.
- **Match on a normalised query.** `trim().toLocaleLowerCase("ru")`, then `includes` on the
  project name and client name, lowercased the same way. An empty query means no search.
- **Reuse `shown` and `arrangeable`.** `shown` tests the query instead of the priority;
  `arrangeable` is "no active search". Groups with no matching project are hidden while
  searching, so a search does not leave empty group cards.
- **Plain `Input` with `type="search"`** and an accessible name, at the filter's place, so
  the layout above the list does not move.

## Risks / Trade-offs

- [Members who used the priority filter lose it] → the priority marker and context menu
  remain; asked for by the product owner.

## Migration Plan

Web-only; no data change.
