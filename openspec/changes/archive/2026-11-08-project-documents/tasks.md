## 1. Documents in the API

- [x] 1.1 Add the `ProjectDocument` model and its migration.
- [x] 1.2 Add `project-document` to the access-policy matrix: read by staff and guests, written by staff.
- [x] 1.3 Add the `project-documents` module: domain, use cases (reach, permission, validation, audit), Prisma repository, routes, schemas and OpenAPI; wire and mount it.
- [x] 1.4 Cover the matrix entry, the mount list and the API: creation and listing in order, reading, renaming, replacing the text, last save wins, deletion, blank and long titles, invalid and oversized content, guests read-only, customers 403, unreachable project and foreign document 404, audit of create, rename and delete only.
- [x] 1.5 Run `npm test` until green.

## 2. The notebook on the web

- [x] 2.1 Add the `project-document` entity: calls and queries.
- [x] 2.2 Move the editor toolbar button to `shared/ui`; build the document editor.
- [x] 2.3 Build the notebook widget: list, create dialog, open document with autosaved title and text, status line, confirmed delete, read-only for guests.
- [x] 2.4 Add the tabs and the notebook routes to the project page; hide the tabs from customers.
- [x] 2.5 Cover the widget and the page: tabs and addresses, list order, creating, editing and autosave, a failed save, deleting with and without confirming, a guest, a customer.
- [x] 2.6 Run `npm run test:web` until green; `openspec validate project-documents --strict`.
