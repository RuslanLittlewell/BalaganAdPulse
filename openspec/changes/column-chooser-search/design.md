## Context

The column chooser is a Radix `DropdownMenu` inside `PerformanceTable`, with one
`DropdownMenuCheckboxItem` per column. `MultiSelect` in `shared/ui` already puts a search field
inside the same kind of menu: it filters with `toLocaleLowerCase("ru")` and `includes`, stops the
propagation of every key but Escape so the menu's typeahead does not take the focus to an item,
focuses the field through `autoFocus`, and clears the text in `onOpenChange` when the menu closes.

Radix handles Escape on the document in the capture phase, so stopping propagation in the field
keeps Escape working. The menu content moves the focus to an item on arrow keys only when the
content itself has the focus, so an arrow key pressed in the field does nothing today.

## Goals / Non-Goals

**Goals:**
- One search field for dropdown menus, used by the column chooser and by `MultiSelect`.
- Keyboard use: type, then the down arrow to reach the list, Space to toggle.

**Non-Goals:**
- Matching across word starts, transliteration or fuzzy matching.
- Moving the focus from the list back to the field with the up arrow.
- Searching inside other menus.

## Decisions

### A shared `MenuSearch` field and a `matchesSearch` helper

`shared/ui/MenuSearch` holds the field markup taken from `MultiSelect`, its key handling and a
`matchesSearch(label, query)` helper. `MultiSelect` switches to them with no change in what it
does, apart from the down arrow. Keeping one copy means both menus behave the same; leaving
`MultiSelect` as it is would leave two copies of the same key handling to drift apart.

### The down arrow focuses the first enabled item from the DOM

On the down arrow the field finds the closest `[role="menu"]` and focuses its first
`[role^="menuitem"]` without `data-disabled`. Radix's roving focus then takes over for the
following arrow keys. Reaching into Radix's item collection is not possible from outside the
menu, and a ref per item would have to be threaded through every caller.

### The chooser keeps its existing rules

The filtered list is `choices` passed through `matchesSearch`. The minimum-columns rule still
looks at the visible columns, not at the filtered list, so a filtered list cannot let the last
figure column be turned off. The text lives in `PerformanceTable` state and is cleared in the
menu's `onOpenChange`.

## Risks / Trade-offs

- [Moving the pointer over an item focuses it, which takes the focus out of the field while the
  member is typing] → This is how `MultiSelect` already behaves; a click in the field brings the
  focus back.
