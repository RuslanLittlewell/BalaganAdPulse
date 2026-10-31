## 1. Database

- [x] 1.1 Add the project account summary table and its migration

## 2. API

- [x] 2.1 Read every account's tiles with the project's
- [x] 2.2 Save tiles for a named account, audited with the account; refuse an account on the dashboard
- [x] 2.3 Describe the account in the request and the accounts in the response in OpenAPI

## 3. Web

- [x] 3.1 Carry account choices in the summary-tiles entity, with the fallback and the optimistic save per account
- [x] 3.2 Show and save the chosen tab's tiles on a split project page
- [x] 3.3 Show the campaign account's tiles on the campaign page

## 4. Tests

- [x] 4.1 Cover per-account reads, saves, audit, roles and the dashboard refusal in the API
- [x] 4.2 Cover the fallback and the per-account cache update
- [x] 4.3 Cover separate tiles per tab on the project page and the campaign page following its account
