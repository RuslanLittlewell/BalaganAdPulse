## 1. Search replaces the priority filter

- [x] 1.1 Add `useDebouncedValue` to `shared/lib`.
- [x] 1.2 In `ProjectList.tsx`, replace the priority select with a search input; narrow projects, pinned items and groups by the debounced query on project and client names; hide unmatched groups; disable dragging while searching; say when nothing matches. Update `ru.ts`.
- [x] 1.3 Update web tests: search by name and by client ignoring case, no narrowing before the pause, nothing-found message, clearing restores dragging, no priority filter; a test for the debounce hook.
- [x] 1.4 Run `npm test` and `npm run test:web` until green; `openspec validate project-list-search --strict`.
