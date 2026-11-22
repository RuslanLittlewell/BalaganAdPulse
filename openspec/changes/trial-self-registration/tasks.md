## 1. Data and platform seam

- [x] 1.1 Add the `TrialSignup` model and its migration
- [x] 1.2 Split the platform's organization creation so a caller can create an organization with the platform's slug and trial rules inside its own transaction
- [x] 1.3 Cover the split with tests and confirm the platform's existing tests still pass

## 2. API module

- [x] 2.1 Create `modules/trial-signups` with ports, repository and the request, check and confirm use cases
- [x] 2.2 Add `TrialLinkMailer` with the Russian message and the 503 rule, and wire it in the composition root
- [x] 2.3 Add the routes `POST /api/trial-signups`, `GET /api/trial-signups/:token`, `POST /api/trial-signups/:token/confirm` with Zod schemas, rate limits, cookies and OpenAPI entries
- [x] 2.4 Test the API: 202 for new and registered emails, 400, 429, 503, replace-by-email, expiry, single use, taken email at redemption, rollback, concurrent redemption, slug collision

## 3. Web

- [x] 3.1 Add dictionary keys to `ru.ts` and `en.ts`
- [x] 3.2 Add the `trial` page and form with its field checks, the sent state and the unavailable state
- [x] 3.3 Add the `trial-confirm` page that redeems once, shows the dead-link message and signs the visitor in
- [x] 3.4 Add the routes, the signed-in redirect and the link from the sign-in page
- [x] 3.5 Test the form checks, the request body, the sent and unavailable states, the dead link and the sign-in after confirmation

## 4. Landing

- [x] 4.1 Point `TrialButton` and the connections section action at `{appUrl}/trial`
- [x] 4.2 Update the landing page tests

## 5. Verify

- [x] 5.1 Run `npm test` and the web and landing suites
- [ ] 5.2 Walk the flow in a browser with mail logged to the server: request, link, confirmation, first screen as `ADMIN`

## 6. Audit fixes

- [x] 6.1 Drop the typed names from the confirmation email and limit requests per email address
- [x] 6.2 Test the email text and the per-address limit
