## 1. The lookup names the bound address

- [x] 1.1 Return `email` (the bound address or `null`) from `resolve` in the invite use cases, and describe it in `invite-openapi.ts`.
- [x] 1.2 Cover the lookup of a bound and an unbound code in the API tests, keeping the uniform error for unusable codes; run `npm test` until green.

## 2. The forms take it from the invitation

- [x] 2.1 Pass the resolved email from `RegistrationPage` to the employee, client and joining forms; with an address, replace the email field by a read-only line naming it and submit with it (the client form also as the contact email); copy in `ru.ts`.
- [x] 2.2 Cover each form with a bound and an unbound invitation by text, roles and the request body; run `npm run test:web` until green.

## 3. Close

- [x] 3.1 Run `openspec validate registration-known-email --strict`, `npm test` and `npm run test:web`, then archive the change.
