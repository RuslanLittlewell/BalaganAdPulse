## Context

See proposal.md for motivation. What shapes the approach:

`TasksPage` already loads the whole module's data in one place — `useTasks()` with no filter
— and hands the same array to either `TaskBoard` or `TaskCalendar` depending on the chosen
view. Reach and the own-work rule are applied by the server, so that array is already exactly
what the member is allowed to see.

`shared/ui/` has no multi-select. The vendored `shared/ui/ui/dropdown-menu.tsx` does export
`DropdownMenuCheckboxItem`; that directory is kept as it arrived and is composed on top of,
never edited.

`shared/lib/moduleMemory.ts` is a persisted zustand store whose state is a set of
`Record<string, string>` maps keyed by user id, one per remembered choice, each with its own
`rememberX` action and all of them named in `partialize`.

## Goals / Non-Goals

**Goals:**
- Narrow both views of the task module by any number of responsible members, instantly.
- Keep the filter honest: it can only take away from what the member already sees.
- Remember the choice per member, without a new request on load.

**Non-Goals:**
- Filtering by anything else (project, priority, stage) — the control is about people only.
- Filtering the project screen's task list or any other surface outside the task module.
- A server-side `assigneeId` query parameter.

## Decisions

**Narrow the array already in hand rather than asking the server.** The module holds every
task the member can reach in one query; selecting from it is instant, needs no API change, and
keeps a single cache entry for the whole module. Alternative considered: an `assigneeId` filter
on `GET /api/tasks`, the way `projectId` works. Rejected — it would split the module's cache by
filter, make each change of the filter a round trip, and complicate the WebSocket fold-in
(`filterOfKey`/`applyTaskEvent` read the query key positionally, and every live update would
have to be matched against a filter that changes as fast as the member clicks).

**Derive the options from the loaded tasks, not from the member listing.** The filter lists
whoever is responsible for something visible. This makes the control answer "whose work is on
this board", keeps it from offering a person whose selection would empty the board, and — the
reason it matters most — needs no role check: an admin sees every assignee because they see
every task, a manager effectively sees only themselves because that is all their board holds.
Alternative considered: list every active member from `useMembers()`. Rejected — it would need
its own request, would offer people with nothing to show, and would have to be hidden or
trimmed by role to avoid leaking who exists.

The name and avatar behind each id still come from the membership listing the module already
has; an assignee whose membership is not in hand is listed by id as a last resort rather than
dropped, so a task can never become unreachable through the filter.

**Offer the unassigned entry only while such a task is visible.** It is derived the same way
as the people: it appears because unclaimed work is on the board, and disappears when there is
none. Implementation note: it needs a sentinel that cannot collide with a membership id — the
task form's existing `UNASSIGNED`/`NO_PROJECT` sentinels are the precedent for this shape.

**A chosen member who leaves the board stays chosen but shows nothing.** When the last task of
a chosen member is reassigned or deleted, that member drops out of the option list. The choice
is not silently dropped with them: the module then shows nothing for that filter, which is
truthful, and unchoosing brings everything back. Dropping the choice automatically would make
the board's content change under a filter the member never touched.

**Remember the choice in `moduleMemory`, as a per-user list.** It is the store the module's
other remembered choice already lives in, persisted under one key, so the filter survives a
reload with no request. The existing maps hold a single string per user; this one holds a list,
so it is a new map of a new shape (`taskAssignees: Record<string, string[]>`) rather than a
reuse of an existing one.

**Do not bump the persisted `version`.** Adding a map is backward-compatible: zustand merges
the persisted payload over the initial state, so a payload written before this change simply
leaves the new map at its default `{}`, which reads as "nothing chosen" — exactly the right
default. A version bump would buy a migration that has nothing to do.

## Risks / Trade-offs

[A member narrows the board, forgets, and later reads an incomplete board as the whole truth]
→ Mitigated by the control showing what is chosen on its face rather than only inside the open
menu, so a narrowed board is visibly narrowed. This is also why the unassigned entry is
explicit: "nothing here" and "nothing matching" stay distinguishable.

[Deriving options from the loaded tasks means the list changes as work moves] → Accepted, and
the reason the chosen filter is kept rather than pruned when a member drops out of the list:
the choice belongs to the reader, not to the data.

[The filter narrows only what was already fetched, so it is not a security boundary] → It was
never meant to be one; the spec states it can only narrow. Reach and the own-work rule stay
where they are, on the server, and the requirement is written so a test can prove the filter
cannot widen.

## Migration Plan

No data or API migration. The persisted store gains a key with a safe default, so an existing
browser payload keeps working untouched (see the version decision above).
