## Why

Every board shows the same four fixed stages: Новый, Квалифицированный, Целевой and КП. Agencies
name these steps of their funnel differently from one client to another, and a custom column
cannot replace a fixed stage because the stage counts, the campaign tables and the integrations
are built on the fixed stages. Members need to give the last three stages the names their client
uses.

## What Changes

- A member who may manage a board's columns can rename Квалифицированный, Целевой and КП on that
  board from the column menu. The stage keeps its place, color, leads and its meaning for counts
  and integrations.
- Новый keeps its name, since new leads from every source land in it.
- The new name follows the rules of a custom column name: trimmed, nonblank, at most 50
  characters and unique on the board without regard to case.
- Entering the stage's original name returns the stage to it, and it is then shown in the
  member's language again.
- The renamed stage appears under its new name on the board, in the table, in filters, in the lead
  panel, in the lead history and in the leads listed on a person or an organization.
- **BREAKING** for API clients that rely on it: `PATCH /api/crm/boards/:boardKey/columns/:id`
  accepts a name for `QUALIFIED`, `TARGET` and `PROPOSAL` instead of refusing it, and a fixed
  column carries `renamed`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lead-crm`: three of the fixed stages can be renamed on a board, and a column name must not
  repeat a stage's name on that board.

## Impact

- Database: a new `lead_stage_name` table with one row per renamed stage of a board.
- API: the column update use case, the column list, the lead history, the leads of a person or an
  organization, OpenAPI.
- Web: the column menu and name dialog for fixed stages and the label of a fixed column. The
  existing copy covers it.
