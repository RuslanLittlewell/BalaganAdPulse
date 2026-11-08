## 1. Data and API

- [x] 1.1 Add `welcomedAt` and `onboardingHiddenAt` to `Membership` with a migration that fills them for existing rows
- [x] 1.2 Add the `onboarding` module domain: step catalogue, role lists, pruning by tariff and Telegram availability
- [x] 1.3 Add the Prisma adapter that reads the step facts and records the welcome and the hiding
- [x] 1.4 Add `GET /api/onboarding`, `POST /api/onboarding/welcome` and `POST /api/onboarding/hide`, mounted before the trial guard, with the Telegram availability port wired in the composition
- [x] 1.5 Document the endpoints in the OpenAPI document

## 2. Web

- [x] 2.1 Add the onboarding query with periodic refetch and invalidation after any mutation, and the welcome and hide mutations
- [x] 2.2 Build `WelcomeDialog` with the text per role and render it from the organization area
- [x] 2.3 Give `Sidebar` a `firstSteps` prop with a pulsing item, and build `FirstStepsDialog` with the steps in order, later ones locked, their links and "Пропустить"
- [x] 2.4 Open the contact book and the profile from `?contacts=` and `?profile=`, with `initialDirectory` on `ContactBook`
- [x] 2.5 Add the `projects.firstAdAccount` hint on the "Добавить интеграцию" tile
- [x] 2.6 Add the Russian copy to `ru.ts`

## 3. Tests

- [x] 3.1 Domain tests for the step lists per role, tariff and Telegram availability
- [x] 3.2 API tests: steps from data for admin and manager, welcome and hide, expired trial, migration filling existing memberships, 401 and 403
- [x] 3.3 Web tests: welcome per role and recorded on close, menu item, its counter and its attention state, steps in order with later ones locked, their links, skipping, closing without skipping, item gone when done, hint on connecting an account
