## 1. Data model

- [x] 1.1 Add enum `Tariff` and `tariff`, `trialEndsAt` to `Organization`; migrate existing rows to `ENTERPRISE`; drop `modules`
- [x] 1.2 Add the tariff catalogue module with limits, modules and trial length

## 2. API

- [x] 2.1 Derive modules from the tariff in the module gate and `/api/auth/me`
- [x] 2.2 Add the `TariffLimits` port and the `LimitReached` error mapped to 403
- [x] 2.3 Enforce limits when creating projects, clients, invites, members and integrations, inside a transaction
- [x] 2.4 Add the read-only guard for expired trials
- [x] 2.5 Return tariff, `trialEndsAt`, limits and usage from `/api/auth/me`
- [x] 2.6 Accept `tariff` in `POST` and `PATCH /api/platform/organizations`, default `TRIAL`, and list tariff and trial end
- [x] 2.7 Update the OpenAPI document

## 3. Web

- [x] 3.1 Replace module checkboxes with a tariff selector in the platform form and edit dialog, with Russian descriptions and prices
- [x] 3.2 Show tariff and trial end in the organization table
- [x] 3.3 Add the tariff and usage view for administrators
- [x] 3.4 Add the trial banner and the read-only notice
- [x] 3.5 Add Russian copy to `ru.ts`
- [x] 3.6 Show tariff refusals in Russian in the client, project, invitation and ad-account forms

## 4. Tests

- [x] 4.1 API tests for each limit, the pending-invite count, downgrade, trial expiry and tariff change
- [x] 4.2 Migration check that every existing organization becomes `ENTERPRISE` with no trial end
- [x] 4.3 Web tests for the selector, banner and usage view
