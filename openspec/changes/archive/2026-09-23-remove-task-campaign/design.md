## Context

`Task.campaignId` is an optional (`String?`) column with `onDelete: SetNull`, indexed, tied
to `Campaign` which stays fully in place for every other domain (leads, KPI metrics, ad
sets, campaign pages). See proposal.md for motivation.

The base `task-board` spec this change deltas against already reflects the
`Назначить`-bundles-project-and-campaign-and-member shape (the `let-tasks-stand-without-a-project`
change was fully implemented in code but left unarchived; it was archived as a prerequisite
step for this change, so the delta here is against accurate, current spec text rather than
the stale pre-merge wording).

Two read-only preview surfaces exist outside the edit dialog: `TaskCard` (Kanban) and
`CalendarTaskEvent` (inside `TaskCalendar.tsx`). Both currently render a campaign line/segment
that must simply disappear, not be replaced by a fallback.

`entities/campaign/model/campaignNames.ts` + `CampaignNamesSync.tsx` back
`GET /api/campaigns/names` (org-wide campaign references) and have no consumer outside the
task feature. `GET /api/projects/:projectId/campaigns/names` (per-project) is a distinct
endpoint the CRM lead form depends on and is untouched.

## Goals / Non-Goals

**Goals:**
- Remove every task↔campaign reference across schema, API, frontend and specs, leaving no
  dead field, prop or dangling test.
- Delete the org-wide campaign-names stack as dead code once tasks stop using it.
- Keep the `Campaign` model, the per-project campaign-names endpoint, and every non-task
  campaign feature (CRM, KPIs, ad sets, campaign pages) completely unaffected.

**Non-Goals:**
- Backfilling or preserving a task's former campaign association anywhere (history table,
  audit note, etc.) — the value is simply dropped.
- Repointing `CampaignPage`'s task list at the project's tasks instead of the campaign's —
  that would duplicate `ProjectPage`'s own list, so the section is removed outright instead.
- Renaming the `Назначить` block or otherwise restructuring the task form beyond removing
  the campaign select from it.

## Decisions

**Drop the column with a new migration rather than deprecate-in-place.** The product wants
the concept gone, not hidden; a nullable, unused column left behind would be exactly the
kind of drift the codebase's "no half-finished implementations" convention rules out.
Alternative considered: leave `campaignId` in the schema but stop reading/writing it from
the application layer. Rejected — it would leave a real, indexed FK relation with no
purpose, and the next person to touch `schema.prisma` would have no way to tell it was
intentionally dead versus forgotten.

**Delete the org-wide campaign-names stack rather than leave it unused.** Confirmed via the
codebase-wide search this change is built on: `useCampaignNames`, `useProjectCampaignNames`
(the task-facing export — not to be confused with `useCampaignReferences`, which is
per-project and stays), `useCampaignNameById` and `CampaignNamesSync` have zero non-task
callers. Once the task form and task previews stop calling them, they are unreachable code.
`PrismaCampaignInProject` and the `CampaignReach` port are dropped for the same reason: they
exist solely to validate that a task's campaign belongs to its project, a check that no
longer applies.

**Shrink the `useTasks` query key from `["tasks", projectId, campaignId]` to
`["tasks", projectId]`.** The key is positional today, and `filterOfKey`, `applyTaskEvent`
and `useTaskEvents` all read it by index — those readers move to the shorter tuple in the
same slice as the query itself, so no intermediate state has a 3-slot key with a stale
meaning for its third slot.

**Remove `CampaignPage`'s "Задачи кампании" section outright.** With no task naming a
campaign, `useTasks({ campaignId })` has no data source. Repointing it at `useTasks({
projectId })` was considered and rejected: `ProjectPage` already shows that same list, and
duplicating it on `CampaignPage` would be a second, redundant read of the same data with no
distinct campaign angle left to justify its own section.

**`campaign-metrics`'s org-wide reference listing is deleted, not just its task caller.**
The requirement's own justification text ties the org-wide form specifically to the task
board ("Naming a campaign on a screen that spans projects — the task board — would
otherwise cost one reading per project"). With that caller gone, the org-wide form has no
remaining reason to exist, so the delta removes it rather than leaving an unjustified extra
capability on the campaigns API surface. The per-project form is untouched — it has its own,
unrelated justification (the CRM lead form) and keeps its own scenarios.

## Risks / Trade-offs

[Existing tasks lose their stored campaign value the moment the migration runs, with no way
back] → Accepted deliberately — see proposal.md's Impact/Data note. This is a local dev/CI
database at the time of this change; if it has already reached a shared environment by the
time this ships, run the migration during a maintenance window rather than against live
traffic, same as any other column-dropping migration.

[The query-key shrink touches WebSocket event filtering (`applyTaskEvent`/`useTaskEvents`),
which is easy to get subtly wrong — a stale filter could show or hide the wrong task on a
live update] → Mitigated by updating the filter and its tests in the same task slice as the
query-key change (see tasks.md), never as a follow-up.

[`task-board`'s spec has several requirements that mention campaign alongside project/
responsible-member content that must survive] → Mitigated by drafting the MODIFIED deltas
directly against the full current requirement text (re-read from
`openspec/specs/task-board/spec.md` after archiving the prerequisite change) rather than
patching remembered snippets, so no unrelated scenario is dropped by accident.

## Migration Plan

1. Backend: add the Prisma migration dropping `Task.campaignId`, its FK and its index, and
   the `Campaign.tasks` back-relation. Update the application/infrastructure/presentation
   layers and their tests in the same slice (see tasks.md) so the schema change and its
   callers land together.
2. Backend: delete `PrismaCampaignInProject`, the `CampaignReach` port, and the
   `assertCampaignInProject` guard; delete `GET /api/campaigns/names` and its test suite.
3. Frontend: update `entities/task` (types, query key, filter logic) first, since the
   feature/widget/page layers depend on its shape.
4. Frontend: update `TaskFormDialog`, `blocks.ts`, `TaskPreviewDialog`, then the read-only
   board/calendar surfaces (`TaskCard`, `TaskColumn`, `TaskBoard`, `CalendarTaskEvent`,
   `TaskCalendar`, `CalendarDay`), then `CampaignPage`.
5. Frontend: delete `entities/campaign/model/campaignNames.ts` and `CampaignNamesSync.tsx`
   and their barrel exports, once nothing in the task feature references them.
6. Remove the corresponding `ru.ts` keys and every test that targeted removed behavior;
   rewrite tests that targeted mixed behavior (campaign alongside project/member) to drop
   only their campaign assertions.
7. No rollback beyond `git revert` plus a down-migration if this has already been deployed;
   this is planning-only until an explicit apply request, per this project's OpenSpec
   workflow.
