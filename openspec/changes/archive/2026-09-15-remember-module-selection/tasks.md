## 1. Remembered CRM board

- [x] 1.1 Write and observe failing web tests for returning to a bare `/crm` after selecting a client board, a remembered board no longer reachable falling back to the default and being forgotten, another signed-in person getting their default board, and a board in the address taking precedence and becoming remembered.
- [x] 1.2 Add the persisted per-person module memory store and make `CrmPage` restore, record and forget the board.
- [x] 1.3 Run `npm test` and `npm run test:web` until both are green.

## 2. Remembered place in the projects module

- [x] 2.1 Write and observe failing web tests for returning to `/projects` reopening the last campaign with its period and the last project, a remembered project no longer reachable showing the unselected state and being forgotten, another signed-in person seeing the unselected state, and nothing remembered showing the unselected state.
- [x] 2.2 Record project and campaign places in `ProjectsPage` and restore or forget them on the index route.
- [x] 2.3 Run `npm test` and `npm run test:web` until both are green.
