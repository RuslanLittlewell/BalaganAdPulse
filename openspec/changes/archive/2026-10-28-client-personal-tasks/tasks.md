## 1. API

- [x] 1.1 Migration and model: `task.personal`
- [x] 1.2 Create: a customer's task with no project is personal and not visible to the client
- [x] 1.3 Reach: admins skip personal tasks; customers reach their own
- [x] 1.4 Editing: the author changes, moves, completes and deletes a personal task; it refuses a project
- [x] 1.5 Audit skipped for personal tasks
- [x] 1.6 Realtime delivery and due-soon notifications reach the author
- [x] 1.7 `personal` in the payload and OpenAPI

## 2. Web

- [x] 2.1 Task type carries `personal`
- [x] 2.2 Editing decided per task in the dialogs, form, board, calendar and list
- [x] 2.3 The form says a client's task without a project is seen by them alone
- [x] 2.4 A client opens every task in the task form; read-only on project tasks, without the visibility switch

## 3. Tests and docs

- [x] 3.1 API tests: creation, reach, editing, audit, realtime, notifications
- [x] 3.2 Web tests: creating and editing a personal task as a client
- [x] 3.3 README
