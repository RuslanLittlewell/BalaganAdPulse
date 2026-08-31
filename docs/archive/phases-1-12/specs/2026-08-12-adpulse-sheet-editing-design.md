# AdPulse Frontend — Design (Phases 7–8: editing the sheet)

**Date:** 2026-08-12
**Status:** approved

> Shared context and conventions: [conventions.md](../conventions.md).

## Context

Phase 4 rendered a campaign as a read-only grid of daily statistics
([2026-08-03-adpulse-campaign-sheets-design.md](2026-08-03-adpulse-campaign-sheets-design.md)),
and Phases 5 and 6 made the sheet strip itself editable — sheets can be created, renamed
and deleted, and a day row can be appended. The grid's contents stayed read-only: a media
buyer can open a sheet and add an empty day, but cannot put a number in it.

This phase closes that gap. The backend needs no change. Every endpoint exists and is
covered by tests:

| Endpoint | Body | Response |
|----------|------|----------|
| `PUT /api/records/:recordId/values/:propertyId` | `{ value: string \| null }` | `{ record, totals }` |
| `PATCH /api/records/:id` | `{ date: "YYYY-MM-DD" }` | the record |
| `DELETE /api/records/:id` | — | `204` |

The value endpoint is the interesting one: it answers with the recomputed row and the
recomputed totals, so a single request carries everything the grid must repaint.

## Scope

**In scope:** editing the value of an entered cell, clearing it, changing a day's date
through a date picker, and deleting a day row.

**Out of scope:** property (column) management, a formula editor, reordering rows or
columns, copy/paste and fill-down, undo, the period filter, KPI tiles, CSV import.
Controls for them are not rendered at all — not rendered disabled.

The work splits into two plans against this one spec. Plan 1 delivers cell editing;
plan 2 delivers row management — the date picker and row deletion. The split keeps the
`DatePicker` component, which is a self-contained piece of work, off the critical path
of the feature's main value: entering numbers.

## Architecture

```
components/EditableCell/     click -> input; Enter/Tab/Esc; saving and error states
components/TrashIcon/        inline SVG, sibling of PencilIcon and CrossIcon
components/DataTable/        + rowAction?: (row) => ReactNode — trailing action column
components/DatePicker/       month-grid popover                              (plan 2)

features/campaigns/
  data/api.ts                + valuesApi.set, recordsApi.update, recordsApi.remove
  data/queries.ts            + useSetValue, useUpdateRecord, useDeleteRecord
  components/CampaignSheet/
    sheetValue.ts            toInputValue / normalizeInput — pure functions
    useSheetEditing.ts       which cell is open, and the Tab transitions
    CampaignSheet.tsx        composition: columns, rows, delete confirmation
lib/http.ts                  + put
```

`DataTable` stays presentational. It gains exactly one prop, and that prop is a
function of a row rather than a flag, so the table learns nothing about deletion or
about trash icons — the feature decides what a row action is. The slot is not called
for the footer: the totals row has no actions.

`EditableCell` knows nothing about campaigns or property types either. It takes
`display` (what to show at rest), `value` (what to seed the input with) and
`onSave(raw) => Promise<void>`. All domain judgement — which type this is, what counts
as valid, what an empty string means — lives in `sheetValue.ts` and reaches the cell
through that promise: a rejection puts the cell in its error state, and the cell does
not care whether a local check or the server rejected it.

`CampaignSheet` is 87 lines today and would pass two hundred with three new
capabilities folded in. The pure value transformations and the editing-position state
move out beside it, so the component stays a composition of parts that are tested on
their own.

## The editing model

A cell is editable when its property has `formula === null` — SPEND, IMPRESSIONS,
CLICKS, LEADS, REVENUE and COMMENT among the seeded columns. Computed columns (CTR,
CPM, CPC, CPL, ROAS) and the TOTAL row stay read-only: they take no focus, and
clicking them does nothing. The server enforces the same rule, rejecting a write to a
computed property, so the UI is not the only guard.

At rest an editable cell renders its formatted value (`1,250.00`, `2.67%`, `—`) inside
a full-size button, which makes it reachable by keyboard and lets Enter open the input
the same way a click does. While editing, an `<input>` takes its place, seeded with the
**raw** value: the API sends `1250.0000`, and the number to edit is `1250`. The text
starts fully selected, so the first keystroke replaces it.

Both states fill the cell rather than floating inside its padding, so the frame around an
open cell reads as that cell rather than as a lozenge dropped into the middle of a row.
And the grid must not move while a cell is open: a column in an auto-layout table is as
wide as the widest thing in it, and an `<input>` contributes its own intrinsic width —
twenty characters by default — instead of the text it holds. So the resting text stays in
flow while editing, hidden and holding the column's width, with the input laid over it
and kept out of the measurement. Without that, opening a cell widens a narrow column and
collapses one whose width rests on the row being edited.

| Key | Effect |
|-----|--------|
| `Enter`, blur | save and close the input |
| `Esc` | discard, restore the previous value |
| `Tab` / `Shift+Tab` | save, then open the next/previous editable cell, crossing into the neighbouring row at a row edge |

At the last editable cell of the last row, `Tab` saves and closes the input rather than
wrapping around to the top; `Shift+Tab` behaves symmetrically at the first cell of the
first row. Editing never leaves the grid, and it never loops.

Closing an input unmounts it, which would otherwise drop focus to the document body and
throw a keyboard user back to the top of the page after every save. So a cell reclaims
focus for its own resting button when it closes — but only when nothing else has taken
it, since a `Tab` that opened the neighbouring cell has already focused that cell's
input and must keep it.

`normalizeInput` prepares the raw text: it trims, reads a comma as a decimal separator
(`1250,5` → `1250.5`), maps an empty string to `null` — clearing a cell, which makes
the server delete the stored value — and validates numeric input against the same rule
the server applies, `-?\d+(\.\d+)?`. Text properties pass through untouched. Input that
fails validation never reaches the network. Neither does input that normalizes to the
value already in the cell: tabbing across an untouched row must not generate traffic.

## Data flow

Every write reaches the same cache entry, `["campaigns", campaignId]`, which already
holds the whole table.

**A cell value.** `useSetValue` writes the `PUT` response into the cache with
`setQueryData`: the record replaces the row with the matching id, and `totals` replaces
the footer wholesale. The entered cell, the computed columns that depend on it and the
totals row all refresh from one request, with no refetch and no flash of stale data.
The server's `ComputedRecord` has the same shape as the client's `CampaignRecord`, so
the response is stored as it arrives.

Fast tabbing can leave two writes in flight at once, and their responses may arrive out
of order. The hook numbers its mutations, but the two halves of a response are not
governed by the same rule. `totals` is one shared value, so the highest-numbered
response wins it outright. A row is not: tabbing across a row edge puts writes against
two *different* records in flight together, and an older response for one record is not
superseded by a newer response for the other — dropping it would erase an accepted write
from the screen while the server holds it, with no refetch to heal the difference. The
row patch therefore carries a per-record high-water mark: a response lands on its own row
unless a later response for that same row already did.

**A row's date.** `PATCH /api/records/:id` returns only the record, and a new date
reorders the rows, so `useUpdateRecord` invalidates the table query instead. One extra
`GET` on a rare operation is the cheaper trade.

**Deleting a row.** `DELETE /api/records/:id` answers `204`; `useDeleteRecord`
invalidates the table query too.

## Errors

An error belongs to the cell that caused it, not to the sheet. The rest of the table
keeps working, nothing is blocked, and there are no toasts or banners.

Input rejected locally never leaves the browser: the cell takes a red border and a
`title` carrying a message from `en.ts`. When the server rejects a write, the cache was
never touched, so the cell falls back to its stored value and shows the envelope's
`message` in `title` — API messages are English, and are fit to display unchanged.
Clicking or pressing Enter on a cell in the error state clears the error and reopens
the input with the text last typed, so a number need not be retyped.

A date conflict (`409`, "The campaign already has a record for …") surfaces the same
way on the date cell. A failed deletion leaves the confirmation dialog open with the
message inside it.

## Row management

`DatePicker` joins the shared library as a popover: a month grid with weeks starting on
Monday, matching the `en-GB` formatting the sheet already uses for days, a header of
the form "August 2026" with arrows to step through months, and marks for today and for
the selected day. It takes `value` as `YYYY-MM-DD` and reports `onSelect(iso)` and
`onClose`. Arrow keys move by day, Enter selects, Esc closes and returns focus to the
cell, and a click outside closes it. It is positioned against its cell, so it travels
with the cell when the table scrolls.

The trash control sits in a trailing column with no header label. It is always
rendered, muted, and gains contrast on hover and focus — dimmed enough not to clutter a
dense grid, but still keyboard-reachable and usable without hovering on touch devices.
The footer's cell in that column is empty. Confirmation reuses the `Dialog` that
already backs client and sheet deletion, with fixed copy and no interpolation: `t()`
takes no parameters, and one string is no reason to change its shape.

## Testing

TDD throughout, tests before implementation, MSW standing in for the API.

The backend does not change. The first step of plan 1 runs the existing API tests for
`PUT /records/:id/values/:propertyId`, `PATCH /records/:id` and `DELETE /records/:id`;
a missing branch is filled in there, not compensated for in the UI.

| Unit | Covered by its test |
|------|---------------------|
| `sheetValue` | Trailing zeros, comma separator, empty string, text, invalid input |
| `EditableCell` | Click opens with the raw value; Enter saves; Esc restores without calling `onSave`; blur saves; a rejected promise shows the error state; a second click clears it; the resting button holds focus after Enter and Esc, and does not steal it when editing moves to another cell |
| `useSheetEditing` | Tab skips computed columns and wraps across row edges |
| `DataTable` | `rowAction` renders in rows and is absent from the footer |
| `CampaignSheet` | Editing SPEND updates CPM and TOTAL, with exactly one `GET` of the table — the proof that the cache is patched rather than refetched |
| `DatePicker` | Month grid, month stepping, selection, Esc, outside click |
| Row deletion | Trash opens the dialog, confirming issues `DELETE`, the row disappears |
