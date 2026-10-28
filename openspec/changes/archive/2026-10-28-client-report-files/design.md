## Context

The API lists drafts to admins and managers only, so a customer's list already holds
published reports alone. The list page renders one table for everyone, hiding the status
column from those who may not edit reports. The staff bar on a report's page shows the status
badge and the publish control.

## Goals / Non-Goals

**Goals:**
- A customer finds a report by its month at a glance.
- Staff cannot miss that a draft is invisible to the client.

**Non-Goals:**
- Publishing on creation, or notifying the client when a report is published.
- Changing what guests see.

## Decisions

- **Tiles for customers, chosen by role.** `isCustomer(role)` picks the tiles; guests keep
  the table, since they are agency people who read figures. The filter by project stays for
  everyone.
- **The tile keeps the API's order**, newest month first, rather than offering sorting: a
  customer reads files by month, and there is nothing in a tile to sort by.
- **White icon on a tile that keeps it legible in both themes**: the accent colour in the
  light theme, a translucent light surface in the dark one.
- **The project name sits under the month on every tile**, so two projects' reports for the
  same month stay apart.
- **The draft hint is text, not a tooltip**: on the report page beside the status, and under
  the staff list when any listed report is a draft.

## Risks / Trade-offs

- [A customer loses the figures in the list] → they are one click away on the report itself,
  and the request asked for files by month.
