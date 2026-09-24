## 1. The API assigns staff on creation

- [x] 1.1 Add failing application tests to `test/projects/project.application.test.ts`: an
  admin naming employees grants them inside the creating transaction; duplicates are
  collapsed; a manager naming anyone is refused `forbidden` and nothing is stored; an
  ineligible id is refused `validation` and nothing is stored; an empty or missing list
  never touches the staffing port.
- [x] 1.2 Declare the `ProjectStaffing` port and `memberIds` on `NewProject`, and implement
  the checks and the grant in `create` in `project-use-cases.ts`.
- [x] 1.3 Add failing API tests to `test/projects/project.api.test.ts`: an admin creates a
  project naming two managers and each lists it; the grant reaches that project alone; a
  manager naming someone gets 403 and nothing is stored; an admin, a client, a suspended
  manager and an outsider are each refused 400 with nothing stored; a malformed id is 400.
- [x] 1.4 Add `memberIds` to `createProjectSchema` (create only, not the update schema) and
  the OpenAPI component; implement `PrismaProjectStaffing` in `members/infrastructure`,
  export it and wire it in `create-container.ts`.
- [x] 1.5 Run `npm test` until green.

## 2. The project form offers Сотрудники

- [x] 2.1 Add failing tests to `ProjectFormDialog.test.tsx`: an admin creating a project sees
  Сотрудники listing only active managers and guests, and the request carries the chosen
  ids; a manager, a client and an admin editing a project are offered no picker.
- [x] 2.2 Add `memberIds` to `ProjectInput`, the strings to `ru.ts`, and the `MultiSelect`
  to `ProjectFormDialog.tsx`, sent only on create.
- [x] 2.3 Run `npm run test:web` until green.

## 3. Close the change

- [x] 3.1 Run `npm test`, `npm run test:web`, `npm run build -w apps/api` and
  `npm run build -w @adpulse/web` until all are green.
- [x] 3.2 Run `openspec validate assign-staff-on-project-create --strict` and confirm the
  implementation matches every scenario in the delta spec.
