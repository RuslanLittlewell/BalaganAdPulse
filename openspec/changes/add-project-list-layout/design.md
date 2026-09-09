## Context

`ProjectList` renders every reachable project as a flat list sorted by priority, with a priority filter above it and a Radix context menu on each row that changes priority. The task board already drives `@dnd-kit` with sortable columns, a drag overlay and an optimistic preview, so the vocabulary for dragging exists. Projects carry a `position` column, but it is agency-wide, assigned once at creation and never reordered. The arrangement being added is personal, so it cannot live on the project row.

## Goals / Non-Goals

**Goals:** one arrangement per member covering order, pins and groups; an arrangement that survives reload and never leaks between members; projects created later appearing without a stored place; dragging that reads the same as the task board's.

**Non-Goals:** agency-wide ordering, nested groups, renaming a group, sharing a group with another member, collapsing a group, changing the project record or any existing project endpoint.

## Decisions

Store the arrangement in two Prisma models keyed by membership: `ProjectGroup` (`id`, `membershipId`, `name`, `position`) and `ProjectPlacement` (`membershipId`, `projectId`, `groupId`, `position`, `pinned`) with a composite key on membership and project. Both cascade from `Membership`, and the placement cascades from `Project`, so leaving the organization or deleting a project takes the arrangement with it. Keying on membership rather than user keeps an arrangement inside the organization it belongs to.

Serve one resource, `GET /api/project-layout`, returning the pinned projects, the top-level items in order and each group's contents, and replace it whole with `PUT /api/project-layout`. The writer is the single member reading it, the payload is a few dozen identifiers, and a whole-layout write keeps ordering out of incremental position arithmetic that a shared board needs but this does not. `position` means the index of an item inside its container — the pinned strip, the top level, or one group — and groups take their index from the same top-level sequence as ungrouped projects.

Reconcile on read rather than on project creation: the layout endpoint reads the member's reachable projects, drops placements for projects that are gone or unreachable, and appends projects with no placement at the end in their existing order. Nothing has to be written when a project is created, and an arrangement cannot be left naming something the member may not see.

Create and delete groups through `POST /api/project-groups` and `DELETE /api/project-groups/:id`, the delete answering 409 while any placement still points at the group. Emptiness is decided by the stored placements, so a group cannot be emptied by a concurrent write and deleted on stale knowledge.

On the client, keep the whole layout in one React Query cache entry, apply a drop optimistically and `PUT` the result, invalidating on error. Render three sortable contexts — the pinned strip, which is not sortable at all, the top level, and one per group — inside a single `DndContext`, mirroring `TaskBoard`. Pins are stored as a flag on the placement rather than as a separate list, so pinning is one write of the same resource.

## Risks / Trade-offs

- A whole-layout write from a stale client can undo a change made in another tab → the layout is personal and rarely edited from two places at once, and the next drop rewrites it from what the member sees.
- Reconciling on read costs one project query per layout read → the same query the list already makes, and the response is small.
- A group and an ungrouped project share the top-level index space → the layout is written whole, so indices are assigned in one pass and cannot collide.
- Pinned projects are excluded from dragging → their order follows the order they were pinned in, which is what the pinned strip is for.
