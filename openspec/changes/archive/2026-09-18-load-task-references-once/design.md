## Context

`createQueryClient` sets no `staleTime`, so every query is stale the moment it resolves and
React Query refetches it whenever a component that asks for it mounts. `TaskFormDialog`,
`TaskPreviewDialog`, `TaskBoard` and `TaskCalendar` each call `useProjects()`, and the two
widgets each run a `useQueries` block over `campaignsApi.namesByProject` — the same block,
copied. Opening a card and switching views therefore re-ask for data the app already holds.

The staff list solved this already: `entities/membership/model/staff.ts` is a zustand store
with a `loadStaff()` that dedupes concurrent calls and returns early once it is `ready`, a
`useMembers()` that reads it with a React-Query-shaped result, and a `StaffSync` mounted in
`App.tsx` that loads at start and resets on unmount. See proposal.md for why this change
follows that pattern rather than tuning `staleTime`.

## Goals / Non-Goals

**Goals:**
- Projects fetched once per session; campaign names once per visit to the task module.
- One request for the names, not one per project.
- Call sites keep their shape, so the change is mechanical and the tests stay meaningful.

**Non-Goals:**
- Changing `staleTime` for the rest of the app: the dashboard, the CRM and the metrics
  readings keep refetching on mount, where freshness is worth the request.
- Moving campaign figures, ad sets, ads or leads into stores.
- Live updates: a store is refreshed by the mutations that change it, not by a subscription.

## Decisions

### Projects follow the staff store, exactly

`entities/project/model/projects.ts` mirrors `staff.ts`: a `useProjectsStore` holding
`projects` and a `status`, a `loadProjects()` that dedupes in flight and returns early once
`ready`, a `refreshProjects()` that reloads regardless, and a `resetProjects()`. `ProjectsSync`
joins `StaffSync` in `App.tsx`.

`useProjects()` keeps its name and the shape its callers read — `data`, `isPending`,
`isSuccess`, `isError`, `isFetching`, `refetch` — so the twelve call sites keep their code.
`useProjects(clientId)` filters the store rather than asking the server for a narrower list:
the store holds exactly the projects the member reaches, so the filtered answer is the same
one the server would give.

The four project mutations call `refreshProjects()` where they invalidated the query key.
Nothing else wrote to that key.

Leaving projects in React Query with a long `staleTime` would have worked as well, and costs
less code; the store was chosen because the app already keeps this kind of list that way, and
one pattern for both is worth more than the few lines saved.

### Campaign names are a store that belongs to the task module

`entities/campaign/model/campaignNames.ts` holds every reachable campaign's reference by id,
with the same load-once shape. `TaskReferencesSync`, mounted by `TasksPage`, loads on entry
and resets on leave, so a name renamed by a Meta sync is picked up the next time the module is
opened rather than never.

The store is the task module's, not the app's: campaigns are read on many screens that want
figures for a period, and only the task module wants a bare name. `useCampaignReferences`
keeps its per-project React Query hook for the lead form and anything else outside the module.

### One reading for the whole organization

`GET /api/campaigns/names` answers with every reachable campaign as
`{ id, projectId, name, channel }`. The repository already has `listReachable(actor)`; the use
case maps it, exactly as the per-project one maps `listReachableByProject`. Reach is the
project's, as everywhere else in the module, so a member who reaches nothing is answered with
an empty list rather than a refusal — there is no project in the request to be missing.

Keeping the per-project endpoint and asking it once per project was rejected: the board spans
every project a member reaches, so that is a request per project on every visit.

### The task listing outlives the switch

`useTasks()` and `useTaskEvents()` move to `TasksPage`, which stays mounted while the tabs
change, and the board and the calendar take `tasks` as a prop. A query that is never
unmounted is never remounted, so no `staleTime` is needed to stop it refetching, and the
websocket is opened once for the module rather than once per view.

The widgets keep `projectId` and their own empty and failed states, so nothing else about
them changes; a caller that renders one of them outside the page passes the tasks it holds.

## Risks / Trade-offs

- [A project created while the task module is open is missing from its pickers until the
  mutation refreshes the store] → The project mutations refresh it, and they are the only way
  a project appears.
- [A campaign renamed by a Meta sync while the task module is open keeps its old name on the
  cards] → Until the module is left and opened again. Campaign names are not editable in the
  app at all, and the previous behaviour — a refetch on every mount — was an accident of
  cache configuration rather than a freshness guarantee.
- [Two stores and React Query now both hold server data] → The split follows the existing
  line: lists that the whole session leans on live in stores, readings that depend on a period
  stay queries.
- [An organization with thousands of campaigns sends them all to name a few] → The payload is
  four short fields per campaign, and the alternative was a request per project. A search
  endpoint is the answer if that ever bites.

## Migration Plan

None. No Prisma schema change, no migration, no stored data touched: the new endpoint reads
what is already there, and the stores live in the browser for the length of a session.
