## 1. Off by default

- [x] 1.1 Default `leadsEnabled` to `false` in the integration use case and the Prisma model, with a migration changing only the column default.
- [x] 1.2 Cover a connection created without the setting being created off; run `npm test` until green.

## 2. The connection window

- [x] 2.1 Start the switch off, show it only with the CRM module, and add the information button opening the Meta setup steps; copy in `ru.ts`.
- [x] 2.2 Cover: the switch starts off and is sent off, it is absent without CRM and the connection is sent off, the information button opens the steps; run `npm run test:web` until green.

## 3. Close

- [x] 3.1 Run `openspec validate meta-leads-opt-in --strict`, `npm test` and `npm run test:web`, then archive the change.
