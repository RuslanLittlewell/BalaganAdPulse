## Why

Opening a task card asks the server for the project list and the campaign names again, and
switching between the board and the calendar asks for both once more — data the app already
holds. The queries are cached under a shared key but with no `staleTime`, so React Query
treats every answer as stale and refetches whenever the component that asked is mounted
again. The task module mounts and unmounts constantly: two views and two dialogs.

## What Changes

- Projects are loaded once when the app starts and kept in a store, the way the staff list
  already is. Every screen reads that store; creating, renaming or deleting a project
  refreshes it.
- Campaign names are loaded once when the task module is opened and kept in a store, and
  dropped when it is left. The board, the calendar, the task form and the task preview all
  read it, so opening a card and switching views ask for nothing.
- The campaign reference listing gains an organization-wide form: one request answers with
  every campaign the member reaches, rather than one request per project.
- The board and the calendar lose the per-project reference queries they each carried.
- The task listing and the realtime connection move up to the page that holds both views, so
  switching between them asks for nothing at all and keeps the socket it already has.

No screen changes what it shows.

## Capabilities

### New Capabilities

### Modified Capabilities
- `campaign-metrics`: campaign references can be listed for the whole organization in one
  reading, not only one project at a time.

## Impact

- **API**: a new `GET /api/campaigns/names`, answering with each reachable campaign's id,
  project, name and channel. The per-project listing stays as it is.
- **Web**: `useProjects` moves from React Query to a store with a sync mounted at app start;
  a campaign-name store with a sync mounted by the tasks page; `TaskBoard` and `TaskCalendar`
  drop their `useQueries` blocks and take their tasks as a prop; `TasksPage` holds the task
  listing and the realtime subscription; the project mutations refresh the store.
- **Dependencies**: none added — `zustand` already carries the staff list this way.
