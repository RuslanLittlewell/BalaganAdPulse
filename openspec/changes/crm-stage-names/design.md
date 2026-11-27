## Context

A board's columns are the four fixed stages, kept in `lead.stage` as the `LeadStage` enum, and the
board's custom columns in `lead_column`. The API lists the fixed stages with their Russian names
from `LEAD_STAGE_NAMES`, and the web ignores that name and shows `crm.stage.<STAGE>` in the
member's language. The column update use case refuses any change to a fixed stage. The stage
identity matters beyond the board: stage counts per project and per campaign, the dashboard and
campaign table columns, the lead import's placement, the Bitrix24 stage mapping and the Meta
import all work with `NEW`, `QUALIFIED`, `TARGET` and `PROPOSAL`.

## Goals / Non-Goals

**Goals:**

- Rename `QUALIFIED`, `TARGET` and `PROPOSAL` per board while the stage stays the same stage.
- Show the board's name wherever a lead's stage is shown for that board.

**Non-Goals:**

- Renaming `NEW`, recoloring, moving or deleting a fixed stage.
- Renaming the stage columns of the dashboard and campaign tables, which add up stages across
  boards, and the fixed stages in the Bitrix24 stage mapping, which is set for the whole
  organization.
- A name per language: a renamed stage shows the same name in Russian and English.

## Decisions

- A table `lead_stage_name` holds one row per renamed stage of a board: `project_id`, `stage`,
  `name` (up to 50 characters), `created_at` and `updated_at`, keyed by project and stage and
  removed with the project. A JSON column on the project was considered and rejected: the table
  gets the enum, the length limit and the cascade from the database. Renaming a stage to
  something else as a custom column, and moving its leads there, was rejected because every
  place that counts stages would lose them.
- The column update endpoint takes the rename. `PATCH /boards/:boardKey/columns/:id` with a stage
  id and only a `name` renames the stage; a position, a color, a delete, or a name for `NEW` is
  refused with 400 as before. The web already calls this endpoint from the column menu.
- A name equal to the stage's original Russian name removes the row, so the stage returns to the
  translated default instead of a stored Russian name.
- The API sends the board's name of a fixed stage in `name` and a `renamed` flag. The web shows
  `name` when `renamed` is set and the translated default otherwise, so an unrenamed stage stays
  in the member's language.
- Uniqueness takes the board's names of the fixed stages, not the defaults: once Целевой is
  renamed Горячий, a custom column may be called Целевой and may not be called Горячий.
- The lead history and the leads of a person or an organization name a stage by the board's
  current name, as they already name a custom column by its current name.
- A rename is recorded in the audit trail as a change of the board's column, with the stage as
  its id, the old and the new name.

## Migration

One migration creates `lead_stage_name` with its primary key and the foreign key to `project`
with `ON DELETE CASCADE`. It adds a table and touches no existing row, so every board keeps its
stages and leads, and the running version, which does not read the table, keeps working between
the migration and the replacement.

## Risks / Trade-offs

- [A member renames a stage to the name another member searches the import or Bitrix24 mapping
  for] → Those screens keep the stage's original name; the board's column menu shows the new one.
- [The English interface shows a Russian name chosen by a colleague] → The name is the board's,
  like a custom column's name, and is shown as entered.
