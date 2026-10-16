## 1. Deleting in the API

- [x] 1.1 Add `delete` to the organization registry (collect the people with no membership elsewhere, delete the organization, delete those accounts, in one transaction), the use case (404 for an unknown id) and `DELETE /api/platform/organizations/:id` with its OpenAPI description.
- [x] 1.2 Cover deletion: the organization and its data gone, its people's accounts gone and their addresses invitable again, another organization untouched, 404, 403 for an organization admin; run `npm test` until green.

## 2. The table

- [x] 2.1 Turn the row actions into icon buttons — pencil, power, trash — with accessible names and tooltips; add the delete dialog that waits for the typed name; give each row a green or red left edge by status; copy in `ru.ts`.
- [x] 2.2 Cover the icon buttons by name, the delete dialog (disabled until the exact name, sends the delete, cancel sends nothing); run `npm run test:web` until green.

## 3. Close

- [x] 3.1 Run `openspec validate organization-deletion --strict`, `npm test` and `npm run test:web`, then archive the change.
