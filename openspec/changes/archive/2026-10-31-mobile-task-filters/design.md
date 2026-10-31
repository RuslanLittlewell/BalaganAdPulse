## Context

`TaskFilters` renders two `MultiSelect`s in a row and is used by `TasksPage` and `ArchivePage`.
The chosen values are remembered per member, so a filtered list can outlive the visit that set
it.

## Goals / Non-Goals

**Goals:**
- The filters behind one icon button on a phone, with a sign that some are active.

**Non-Goals:**
- The rest of the task header on a phone.

## Decisions

- **Two presentations switched by breakpoint, one of them mounted on demand.** The inline row is
  `hidden md:flex`; the button is `md:hidden` and opens a `Popover` whose content mounts only
  while open. The filters therefore appear once in the page until the popover is opened, which
  only a phone can do, where the inline row is hidden. A media-query hook would add a second
  source of truth for the breakpoint.
- **The count of active choices on the button**, as a badge and in its accessible name. The
  filters are remembered, so without it a phone user would see a shortened list with no hint why.
- **`MultiSelect` inside the `Popover` as is.** Radix layers nest: the dropdown is a child layer
  of the popover, so choosing in it does not dismiss the popover.

## Risks / Trade-offs

- [In the test DOM both presentations exist once the popover is open] → tests of the popover
  scope their queries to its dialog.
