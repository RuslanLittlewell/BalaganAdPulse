## 1. Narrowing by project

- [x] 1.1 Add to `entities/task/lib/` a helper listing the projects of the given tasks plus the chosen ones, with a Без проекта entry while a task has no project or it is chosen, and a helper narrowing tasks to the chosen projects; export them from the entity.
- [x] 1.2 Remember the chosen projects per user in `useModuleMemory`, next to `taskAssignees`.
- [x] 1.3 Add the project `MultiSelect` to the `TasksPage` header with project avatars, narrowing after the responsible-member filter, so board and calendar receive the same list; add its copy to `ru.ts`.
- [x] 1.4 Cover the helpers: listing, Без проекта offered and not, a chosen project kept, narrowing to one, several and none.
- [x] 1.5 Cover the page: narrowing the board, combining with the responsible filter, keeping the filter when switching to the calendar, surviving a remount, one user's choice not shown to another.
- [x] 1.6 Run `npm run test:web` until green; `openspec validate task-project-filter --strict`.
