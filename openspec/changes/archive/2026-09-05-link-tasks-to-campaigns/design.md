## Context

See `proposal.md` for motivation. The tasks module owns `Task` and reaches projects
through a `ProjectReach` port that answers which client a project belongs to. The
campaigns module owns the hierarchy and, since `rebuild-campaign-metrics`, exposes only
range-scoped readings. Tasks and campaigns are separate modules, and the architecture
test refuses an import from one into the other's internals.

## Goals / Non-Goals

**Goals**

- One field, optional, whose absence has a positive meaning rather than being a gap.
- A campaign that cannot contradict its task's project, in any order of edits.
- A picker that costs a listing, not a metrics computation.

**Non-Goals**

- Filtering or grouping the board by campaign. The link is what makes that possible
  later; this change stores and shows it.
- A campaign column on the board, or a per-campaign task count on the campaign screen.
- Moving tasks automatically when a campaign moves between projects. Campaigns do not
  move between projects.

## Decisions

### `campaignId` is nullable, and null means Общий

Null is not "not filled in": it is the statement that the work is about the project as a
whole. Everything else follows from that — no default campaign is chosen, no validation
requires one, and the interface names the state instead of leaving the control blank.

The alternative was a sentinel campaign per project called "Общий". It was rejected
because it puts a fiction in the campaign table: it would appear in the metrics
hierarchy, in channel breakdowns and in every campaign listing, and each of those would
need to know to hide it.

### Deleting a campaign sets its tasks' campaign to null, never cascades

`ON DELETE SET NULL`. A task is work somebody owns; a campaign is a thing on a platform.
Deleting the second must not destroy the first. The task becomes Общий, which is exactly
what it now is.

### The project–campaign agreement is enforced in the use case, on the merged result

The rule is not "the request's campaign matches the request's project" — the request may
change one, the other, both, or neither. It is "the task, as it will be stored, has a
campaign belonging to its project". So the use case computes the resulting project first,
then validates the resulting campaign against it.

Changing the project alone releases the campaign rather than being refused. Refusing
would make an ordinary edit fail for a reason the member did not ask about; releasing
states the truth, which is that the old campaign is no longer under this task's project.
Naming the old project's campaign *explicitly* while moving is refused, because that is
a contradiction the member did write.

### A campaign belonging to an unreachable project is refused as invalid, not as missing

A campaign the actor cannot reach and a campaign that does not exist give the same 400.
The task's own project is already reachable — it was checked — so the answer leaks
nothing about what else exists; making the two indistinguishable keeps it that way.

400 rather than 404 because the failing thing is a field of the request, not the address:
the task or the project named in the URL was found.

### The tasks module owns a `CampaignReach` port; the campaigns module implements it

`isInProject(campaignId, projectId)`, answered by the composition root from the campaigns
module's repository. The tasks module states what it needs to know and never learns what
a campaign is, which keeps the two modules independent and the architecture test quiet.

### Listing campaigns for a picker is a separate address from listing them with figures

`GET /api/projects/:projectId/campaigns/names` answers `{ id, name, channel }[]`.

The alternative — making `from`/`to` optional on the metrics listing and omitting
`performance` when they are absent — was rejected: one address answering two shapes
forces every typed client to handle a field that is sometimes there. The picker's need is
genuinely different, and it is cheap: one query, no per-campaign metric reads.

## Risks / Trade-offs

- [A second campaign-listing address could drift from the first] → Both are built from
  the same repository method on the same reach filter; only the projection differs.
- [Releasing a campaign on a project change is silent] → The form clears the campaign
  select the moment the project changes, so the release is visible before saving rather
  than discovered afterwards.
- [Tasks left as Общий after a campaign is deleted are indistinguishable from tasks that
  always were] → Accepted. The audit trail records the deletion, and inventing a
  "was on a deleted campaign" state would be a third meaning for a field that has two.

## Migration Plan

One additive migration: a nullable `campaign_id` column on `task` with a foreign key to
`campaign` and `ON DELETE SET NULL`, plus an index for reading a campaign's tasks. Every
existing task keeps its meaning — none named a campaign, and none now does.

Rollback drops the column; tasks lose their campaign and are Общий again, which is what
they were before the change.
