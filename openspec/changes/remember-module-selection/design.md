## Context

See proposal.md for motivation and the specs for behaviour.

- CRM keeps its board in the `board` query parameter and falls back to the first reachable board. The menu links to the bare `/crm`.
- The projects module routes `/projects`, `/projects/:projectId` and `/projects/:projectId/campaigns/:campaignId`, with the reporting period in `from`/`to` query parameters. Its index route renders the unselected state.
- `useSelectionStore` in `entities/project` mirrors the current address and remembers nothing.
- Client state already uses zustand. `columnWidths` persists through the `persist` middleware to localStorage.
- `useAuth()` exposes the signed-in user's id once the session loads.

## Goals / Non-Goals

**Goals:** restore the last CRM board and projects place across module switches and reloads, per person, without API changes.

**Non-Goals:** syncing the choice across devices; remembering places in other modules (dashboard period, tasks filters); changing links elsewhere in the app.

## Decisions

### One persisted store keyed by user

`shared/lib/moduleMemory.ts` holds a zustand store persisted as `adpulse-module-memory`, with `boards` and `projectPlaces` maps from user id to value and remember/forget actions for each. Keying by user id keeps one person's choice away from another on a shared browser and needs no clean-up at logout.

A separate store per module was rejected: the two are the same concern and would duplicate persistence plumbing. The existing `useSelectionStore` was rejected because it mirrors the address and must stay empty outside the projects module.

### Restore at the destination, not in the menu

Pages read the memory when they are opened without a selection, rather than the menu building remembered links. Every entry point that lands on a bare `/crm` or `/projects` — menu, redirects, back navigation — then behaves the same, and reachability is checked against data the page already loads.

**CRM.** `CrmPage` resolves the displayed board as the address board, else the remembered board if it is in the reachable board list, else the first board. When it uses the remembered board, it writes it into the address with `replace`, so no default board is fetched first. A board named in the address is remembered once it is found among the reachable boards. A remembered board missing from the list is forgotten.

**Projects.** `ProjectsPage` records `pathname + search` whenever the address is a project or campaign page. The index route waits for the reachable project list:
- if the remembered project is in the list, it redirects there with `replace`;
- otherwise it forgets the place and renders the unselected state.

It renders nothing while the list loads, so the unselected state does not flash before a redirect.

## Risks / Trade-offs

- [A remembered campaign deleted inside a reachable project] → The campaign page shows its existing not-found state with a way back. Navigating to the project replaces the remembered place.
- [localStorage unavailable or full] → zustand persist fails quietly and behaviour falls back to today's defaults.
- [Session not loaded yet on first render] → Nothing is restored or recorded until the user id is known.
