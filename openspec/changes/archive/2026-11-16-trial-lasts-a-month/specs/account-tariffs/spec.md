## RENAMED Requirements

- FROM: `### Requirement: A new organization starts on a 14-day trial`
- TO: `### Requirement: A new organization starts on a one-month trial`

## MODIFIED Requirements

### Requirement: A new organization starts on a one-month trial

An organization created through `POST /api/platform/organizations` SHALL start on `TRIAL`
with `trialEndsAt` set one calendar month after creation, at the same time of day, unless the
request names another tariff. A trial started on a day the next month does not have SHALL end on
that month's last day.
Assigning a tariff other than `TRIAL` SHALL clear `trialEndsAt`.

#### Scenario: Default tariff
- **WHEN** the platform administrator creates an organization without a tariff
- **THEN** it is on `TRIAL` and `trialEndsAt` is one month away

#### Scenario: A trial started at the end of a month
- **WHEN** an organization starts its trial on 31 January
- **THEN** the trial ends on the last day of February, at the same time of day
