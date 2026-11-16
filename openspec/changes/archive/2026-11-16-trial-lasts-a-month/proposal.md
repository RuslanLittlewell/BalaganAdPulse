## Why

Fourteen days is too short for an agency to connect its clients' accounts and see a month of
results, so the trial is extended to one month, and the landing now offers it.

## What Changes

- A new organization on `TRIAL` gets `trialEndsAt` one calendar month after creation instead of
  14 days. Organizations already on a trial keep their dates.
- The platform form describes the trial as a month, and the API documentation says so.
- The landing's opening offers a free month and its dashboard imitation follows the dashboard's
  row of KPI doughnut, notices, due tasks and sources.

## Capabilities

### New Capabilities

### Modified Capabilities
- `account-tariffs`: the trial lasts one month.
- `platform-administration`: a new organization's default trial ends one month ahead.
- `public-landing`: the opening offers a free month, and the imitation's layout.

## Impact

- `packages/access-policy`: `trialEndsAtFrom` adds a calendar month; `TRIAL_DAYS` goes away.
- `apps/api`: platform API description and tests.
- `apps/web`: the trial tariff's description.
- `apps/landing`: the trial note, the contact form's lead and the imitation.
- Development containers read the package from a volume and must be rebuilt to pick it up.
