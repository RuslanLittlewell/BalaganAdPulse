## 1. Layout storage

- [x] 1.1 Write and observe failing Prisma adapter tests for reading, replacing and isolating one membership's placements and groups.
- [x] 1.2 Add the `ProjectGroup` and `ProjectPlacement` models with their migration and implement the repository.

## 2. Layout use cases

- [x] 2.1 Write and observe failing application tests for reconciling a stored layout with reachable projects, appending unplaced projects, rejecting an unreachable project, creating a group and refusing to delete a group holding projects.
- [x] 2.2 Implement the layout use cases and their ports.

## 3. Layout API

- [x] 3.1 Write and observe failing API tests for `GET`/`PUT /api/project-layout`, `POST /api/project-groups`, `DELETE /api/project-groups/:id`, their validation, 404 and 409 answers and their isolation between members.
- [x] 3.2 Implement the router, Zod schemas and OpenAPI description, and wire the module into the container and routes.
- [x] 3.3 Run `npm test` to green.

## 4. Ordering and pinning in the list

- [x] 4.1 Write and observe failing widget tests for the manual order replacing the priority sort, a keyboard-reachable drag, pinning and unpinning from the context menu, the pinned strip standing apart and pinning a grouped project out of its group.
- [x] 4.2 Add the layout query and mutations to the projects entity and render the list from the layout with `@dnd-kit`.

## 5. Groups in the list

- [x] 5.1 Write and observe failing widget tests for creating a group through the list's context menu and its dialog, the empty-name refusal, dragging projects into and out of a group, dragging a group, deleting an empty group and the Russian refusal for a group holding projects.
- [x] 5.2 Render groups as sortable containers with their header, context menu and creation dialog, and add every visible string to `ru.ts`.
- [x] 5.3 Run `npm run test:web` and `npm run build:web` to green.

## 6. Close out

- [x] 6.1 Run `openspec validate add-project-list-layout --strict`, `npm test` and `npm run test:web` to green.
