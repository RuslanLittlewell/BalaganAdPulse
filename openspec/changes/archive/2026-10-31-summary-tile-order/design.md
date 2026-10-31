## Context

Summary tiles are stored as ordered Postgres arrays — per membership for the dashboard, per
project for the project page — but both the API and the web client sort them into catalogue
order, so the stored order never mattered. The summary is a responsive grid of one to six
columns. A project's KPI tile is not one grid item: it renders a card per KPI straight into
the grid, so two or three KPIs take two or three cells and flow with the other tiles.

## Goals / Non-Goals

**Goals:**
- Rearrange the dashboard's and a project's tiles by pointer and by keyboard.
- A project's KPI cards stay together and move as one, without changing how the grid lays
  them out today.

**Non-Goals:**
- Rearranging inside the dialog, or rearranging a project's KPI cards among themselves.
- Touch dragging, which no other list in the app offers either.

## Decisions

- **The API keeps the order it is sent.** The schema already refuses repeats and unknown
  tiles, so dropping the catalogue sort is enough; stored lists stay valid as they are.
- **The KPI group keeps `display: contents`.** Spanning a single wrapper over two or three
  columns would leave holes in rows the group no longer fits, which the current flow does not.
  dnd-kit cannot measure a box-less element, so the summary measures such a node as the
  union of its children's rectangles.
- **Live reorder with a drag overlay instead of sortable transforms.** Transform-based sorting
  assumes items of one size; with a group two or three cells wide the shifted tiles would
  overlap. Reordering the list while dragging lets the grid lay itself out, and the carried
  tile follows the pointer in an overlay.
- **A tile moves only when the pointer reaches a different tile.** After a reorder the tile
  under the pointer is often the one just passed; moving again would swap back and forth.
  Passing over the carried tile's own place, then another tile, moves it again.
- **Keyboard moves through a handle, not dnd-kit's keyboard sensor.** One arrow press moves
  one place and saves at once, which suits a row of at most five tiles better than picking up
  and dropping. The handle refocuses itself if the reorder moved its node, and a status line
  announces the new place. dnd-kit's English announcements are silenced.
- **The pointer listens on the whole tile.** It matches the boards and the project list, and
  a four-pixel threshold keeps the KPI card's own buttons clickable. Pointer presses inside a
  KPI dialog, which React bubbles through the tile, are ignored.
- **The handle lives in `shared/ui`.** The summary renders it on its own tiles and the KPI
  feature on each project KPI card, which the summary does not render itself.

## Risks / Trade-offs

- [Older unarchived changes still state catalogue order] → `import-meta-results` and
  `project-summary-shared` modify the same requirement; whoever archives them after this one
  must keep this requirement's text instead of theirs.
- [A wide KPI group's overlay squeezes its cards into one row when they wrapped] → only on
  narrow screens with more KPIs than columns, and only while dragging.
