## Context

The CRM page (`pages/crm/CrmPage.tsx`) has three parts:
- a board selector;
- tabs for Канбан and Календарь, remembered per person in `shared/lib/moduleMemory`;
- a Создать button that opens `features/lead-management/ui/LeadCard.tsx`. That is a centered dialog built on react-hook-form, and it stores everything on Сохранить.

`widgets/crm-board` renders columns with dnd-kit and the shared drag helpers (`resolveLeadDrop`, `applyLeadMove`, `useDragPreview`). `GET /api/crm/boards/:key/leads` returns the whole board, and `useCrmEvents` refetches it on `crm.changed`. Custom fields, their editors and the option chip exist from `crm-custom-fields`.

The reference is the user's Twenty workspace, the Opportunities "By Stage" view. A clone of Twenty sits at `~/Documents/Work/twenty`. Its `twenty-front` is AGPL-3.0, so it is only read for behavior and never copied. The user wants Twenty's layout and interaction adapted to AdPulse: colors, tones, type sizes and the font stay ours.

## Goals / Non-Goals

**Goals:**
- Adapt Twenty's layout and interaction on the CRM board, the cards and the lead panel to our design system and stack: our theme tokens, Montserrat and our type scale, with React Query, REST, Tailwind and dnd-kit.
- Make search, filter, sort and card options work entirely in the browser over the board that is already loaded.
- Keep the view state in a shape that the saved-views change can store on the server unchanged.

**Non-Goals:**
- Saved, named or shared views. Those are the next change.
- The table layout, multi-select of cards and bulk actions.
- A full-page record view. The panel has no expand button yet.
- Copying Twenty's colors, tones, sizes or font. Restyling the rest of the application.
- Choosing which aggregate a column header shows. It always shows the count and the amount sum.

## Decisions

### Our tokens, Twenty's arrangement

The CRM keeps the app's theme tokens: `background`, `card`, `muted`, `border`, `foreground`, `muted-foreground` and `primary`, in light and dark. It also keeps Montserrat and our type scale. What changes is the arrangement:
- thin column dividers instead of panels;
- a pill per column header;
- dense cards with icon rows;
- a docked panel;
- a single view bar.

The column pill and the option chip share our existing eight-color classes from `entities/lead/ui/OptionChip.tsx`. Nothing from `twenty-ui` or `twenty-front` is copied.

Alternative considered: porting `twenty-ui`'s grays, tag colors, sizes and Inter. It would match the reference more closely, but the CRM would no longer look like the rest of AdPulse, and the user chose our own look.

### Icons stay lucide

Twenty uses Tabler icons. Lucide, which we already ship, draws the same family of 1.5–2px outline icons. A second icon set would double what we maintain for a small visual gain.

### The view state lives in the browser and is applied client-side

`features/lead-view-options/model/viewState.ts` defines the state:

`ViewState = { search, filters: Filter[], sort: Sort | null, cardFields: FieldRef[], hideEmpty, compact }`

- A `FieldRef` names a built-in field key or `custom:<fieldId>`.
- A `Filter` is `{ field: FieldRef, operator, value }`.

A zustand `persist` store keeps the state by `<userId>:<boardKey>` under its own storage key. The layout stays in `moduleMemory.crmViews`, since it is per person rather than per board.

Pure functions in `features/lead-view-options/lib` do the work:
- `operatorsFor(fieldType)`, `matches(lead, filter, fields)`, `visibleLeads(leads, state, fields)` and `compareBy(sort, fields)`;
- `pruneState(state, fields, columns)`, which drops references to deleted custom fields, options and columns.

The board, the calendar and the column totals all read `visibleLeads`.

Why client-side: the API already returns the whole board for drag-and-drop and realtime, and boards hold hundreds of leads. Filtering in memory is instant and needs no API surface that the saved-views change would have to redesign.

The operator table is our own. It is shaped after the per-type operator sets Twenty offers, and trimmed to our field types.

Arrival time is the Meta submission time for imported leads and `createdAt` for the rest, the same rule as the calendar and the stage counts. Date operators compare UTC calendar days, which is the day the calendar shows a lead on.

### Dragging with a filter or a sort on

When a filter or search hides some leads, a drop between two visible cards is translated to the full column: the lead lands just before the visible card it was dropped above, or after the last visible card. That keeps the stored order meaningful for when the filter is cleared.

While a sort is on, the drop handler ignores drops within the same column and sends a move to another column with the last position. The display then places the card by the sort. The shared `resolveLeadDrop` stays as it is. The translation lives in a small `boardPlacement` helper in `widgets/crm-board`, with its own tests.

### The side panel is a docked region, not a dialog

`widgets/lead-side-panel` renders an `<aside aria-label="<lead name>">` docked to the right of the CRM content, about a third of the content width (480px). On screens below `md` it becomes a fixed overlay. It is not modal, so the board stays usable, matching Twenty.

The open lead is the `lead` search parameter, and the lead itself comes from the board's leads query, so the panel needs no extra request. An id that is not on the board renders nothing. Escape closes the panel unless an inline editor holds focus; in that case Escape cancels the edit first.

The panel replaces `features/lead-management/ui/LeadCard.tsx`. The tabs `LeadActivityTab`, `LeadFilesTab` and `LeadSourceSection`, the tag editor and the custom value helpers move under the panel unchanged.

### Inline editing saves one field per request

`InlineField` shows a value and switches to an editor on click, Enter or Space. It reuses the type editors from `CustomFieldRow` and the built-in inputs, made controlled and independent of react-hook-form.
- Text-like editors commit on Enter or blur.
- Pickers commit on selection.
- Escape restores the value.
- The commit sends `PATCH /leads/:id` with that one key. Stage changes go through the move endpoint with the last position, as the dialog did.
- The returned lead is written into the leads query cache, so the card updates at once.
- A refusal restores the old value and raises the error alert.

Client-side validation reuses `customValueProblem` and `isAmount`.

Alternative considered: keeping react-hook-form and auto-saving the whole form. That sends every field on each change and reintroduces the overwrite problem that per-field saving removes.

### Column colors are stored on the column

`lead_column.color` is `VARCHAR(16) NOT NULL DEFAULT 'gray'`. The domain checks it against the shared palette, `OPTION_COLORS` from `lead-field.ts`. The fixed stage colors live in the domain as `FIXED_STAGE_COLORS` (`NEW` blue, `QUALIFIED` purple, `TARGET` orange, `PROPOSAL` green), and `boardColumns()` attaches a color to every entry. `updateColumnSchema` accepts `color`, and the existing fixed-stage check already refuses changes to fixed stages.

A Prisma enum was not used: the palette is shared with field options, which are stored as JSON strings, and one string check keeps both in step.

### Creating from a column

`+ Новый` toggles a `NewLeadInput` at the end of the column. Enter sends `POST /leads` with `{ name, stage: column.id }`, then sets `lead=<id>` in the address to open the panel. Создать in the header opens the same input in Новый on the board. In the calendar layout it opens it in a small popover.

### Page structure

`pages/crm` renders three parts:
- `CrmViewBar`, from `features/lead-view-options`: board picker, search, Фильтр, Сортировка, Настройки and the chip row;
- the chosen layout;
- the panel.

The Канбан/Календарь tabs and the separate Поля button are removed. Поля доски opens `LeadFieldsDialog` from Настройки.

## Risks / Trade-offs

- **[Saving per field produces more audit events and more activity entries than one save of the whole dialog.]** This is what Twenty does, and each entry stays small. Typing into a text value is one save on blur, not one per keystroke.
- **[Leads hidden by a filter can confuse someone who drags or totals.]** Totals say what is shown, and the chip row and Сбросить make the filter visible. Drops map to the full column order.
- **[Client-side filtering does not scale to very large boards.]** The board is already loaded whole. If boards reach tens of thousands of leads, the saved-views change can move filtering to the API with the same state shape.
- **[Someone could paste AGPL code from the local Twenty clone.]** Review checks that new files are written for our stack and are not copies of `twenty-front`.
- **[Rewriting the lead card breaks many web tests.]** The tasks rewrite those tests against the panel and keep the scenarios they covered.

## Migration Plan

One additive migration: `ALTER TABLE "lead_column" ADD COLUMN "color" VARCHAR(16) NOT NULL DEFAULT 'gray'`. Existing custom columns become gray, and every other row is untouched. The api container applies it on start. A rollback drops the column.

Saved browser state is new, so there is nothing to migrate. The old `crmViews` layout memory keeps working, with its values `board` and `calendar`.
