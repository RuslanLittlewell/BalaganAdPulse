## Why

Two follow-up requests on the CRM board. First, a lead's card gives no visual cue about which
column it sits in beyond its position on screen — the column header already carries an accent
colour (the small dot beside its name), and the card should carry the same colour so a card
still reads as belonging to its column when scrolled, dragged, or seen in the drag overlay.
Second, a custom column can today only be reordered among the other custom columns, always
stuck after all four fixed stages — a media buyer who wants a column like Встреча to sit right
after Новый, before a prospect is even Квалифицированный, currently cannot place it there.

## What Changes

- A lead card's border takes the accent colour of its stage or column — the same colour the
  board's column-header dot already uses — instead of the neutral border colour. Purely
  visual: no new field, no test (styling is not asserted on per this repo's conventions).
- **BREAKING** A custom column can be moved to any position on the board, including before the
  first fixed stage or between two fixed stages, not only among the other custom columns.
  `PATCH /crm/boards/:board/columns/:id`'s `position` now means "target index across the whole
  board (fixed stages and custom columns together)" rather than "target index among the custom
  columns only" — same field, same shape, different meaning, so an existing caller passing a
  fixed `position` value to reproduce a specific order needs to recompute it.
- Fixed stages are unaffected: still exactly four, still `NEW → QUALIFIED → TARGET →
  PROPOSAL` relative to each other, still un-renameable, un-deletable and un-movable
  relative to one another. Only where custom columns sit around them changes.
- `LeadColumn` gains a stored anchor (which fixed stage, or none, it immediately follows) so
  the board can be rebuilt in the right interleaved order; a one-time migration sets every
  existing custom column's anchor to the last fixed stage, reproducing today's "always after
  all four" order exactly, so no board's visible order changes on deploy.

## Capabilities

### Modified Capabilities
- `lead-crm`: a custom column's position spans the whole board, not just the custom columns,
  so it can sit before, between or after fixed stages.

## Impact

- **API**: `LeadColumnRecord` and the `lead_column` table gain `afterStage` (nullable
  `LeadStage`; null means "before `NEW`"). `boardColumns()` groups custom columns per anchor
  instead of appending them all after the fixed four. `updateColumn`'s reposition logic walks
  the full board order (fixed stages plus customs) instead of the customs-only list.
  `createColumn` keeps defaulting new columns to the end of the board (anchor `PROPOSAL`), so
  the "add column" placeholder's behaviour is unchanged. One migration backfills existing rows.
- **Web**: `LeadColumnMenu`'s move-left/move-right now index against the full column list
  (already available as the `columns` prop) instead of filtering to custom columns first, so
  the same buttons can now step a column across a fixed stage. `LeadCard` reads its stage's
  accent the same way `CrmColumnPanel` already does, and both are aligned into one shared
  accent lookup in `widgets/crm-board` so the dot and the border can never drift apart.
- **Dependencies**: none added.
