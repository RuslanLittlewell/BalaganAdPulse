## 1. Permission matrix and API

- [x] 1.1 Write and observe failing tests for the matrix rows of projects, `integration`, `kpi` and `project-priority`; customers creating and editing their client's projects through the API with the agency seeing them; refusing another client, deletion, priority changes, integration reads and writes and KPI changes for customers.
- [x] 1.2 Update the matrix and enforce `project-priority`, `integration` and `kpi` in the project, integration and KPI use cases.
- [x] 1.3 Run `npm test` and `npm run test:web` until both are green.

## 2. Customer project interface

- [x] 2.1 Write and observe failing web tests for a customer seeing the create control and edit action but no priority menu, the project form fixing their client without client creation or deletion, and the Meta panel and KPI editing staying hidden from them.
- [x] 2.2 Gate the list, form, Meta panel and KPI editing on the new permissions and fix a customer's client in the form.
- [x] 2.3 Run `npm test` and `npm run test:web` until both are green.
