## 1. API

- [x] 1.1 Make the provider error type, the provider value and the OpenAPI enum provider-neutral, and add `GOOGLE`, the value its campaigns already use as their channel
- [x] 1.2 Prisma: refresh credential and manager-account fields on the integration, with a migration
- [x] 1.3 Google OAuth: start and callback routes with a single-use state bound to member and project, account listing, configuration check
- [x] 1.4 Google Ads client producing the import snapshot (hierarchy, daily figures, micros to decimal, missing reach as zero)
- [x] 1.5 Revoked-credential handling and sign-in again on the same connection
- [x] 1.6 Connect, list, refresh and disconnect for Google connections; OpenAPI
- [x] 1.7 Cover the client, the state rules, the import and the revoked path with tests

## 2. Web

- [x] 2.1 Make Google selectable in the provider window and start sign-in from it
- [x] 2.2 Account choice after sign-in, the Google panel with refresh, status and disconnect, and the sign-in-again prompt
- [x] 2.3 Name the Google tabs `Google · account` and keep campaigns apart
- [x] 2.4 Russian copy and tests

## 3. Configuration

- [x] 3.1 Document the Google client id and secret, developer token and redirect address in `.env.example`, docker compose and the README
