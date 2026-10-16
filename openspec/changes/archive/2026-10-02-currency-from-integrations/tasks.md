## 1. Store any integration currency

- [x] 1.1 Migrate `project.budget_currency` to a nullable 3-letter text column with a code check and no default; drop the `currency` enum; regenerate Prisma.
- [x] 1.2 Drop currency from the project create/edit, registration and invite inputs and from the project domain; make it `string | null` in records and OpenAPI.
- [x] 1.3 On Meta connect, adopt the account's currency in the connection transaction; refuse only when the project holds figures in another currency.
- [x] 1.4 Update API tests: created projects have no currency and ignore one sent; editing ignores it; connect adopts USD on an empty project and refuses with figures in another currency.

## 2. Show it in the web

- [x] 2.1 Make the web currency type `string | null`; format known signs, any other code by its symbol, and `null` without a sign.
- [x] 2.2 Remove the currency field from the project form and the client registration form.
- [x] 2.3 Update web tests: no currency field in either form; formatting of null and of an unlisted code.
- [x] 2.4 Run `npm test` and `npm run test:web` until green; `openspec validate currency-from-integrations --strict`.
