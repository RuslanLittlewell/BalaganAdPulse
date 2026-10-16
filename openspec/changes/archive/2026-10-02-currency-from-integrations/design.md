## Context

`project.budget_currency` is a Postgres enum (`BYN`, `RUB`, `USD`, `EUR`, default `BYN`)
set from the project form and the client registration form. Meta connect reads the
account's currency and refuses on mismatch; the import job re-checks the project's
currency under a row lock before writing figures. Figures live in `CampaignDailyMetric`,
`AdSetDailyMetric` and `AdDailyMetric`, written only by the import.

## Goals / Non-Goals

**Goals:**
- Currency set by integrations only; any ISO 4217 code.

**Non-Goals:**
- Converting figures between currencies.
- Integrations other than Meta, which do not exist yet.

## Decisions

- **Text column, nullable, no default.** `ALTER TABLE project ALTER COLUMN budget_currency
  TYPE VARCHAR(3) USING budget_currency::text`, drop the default and `NOT NULL`, drop the
  enum. A `CHECK (budget_currency ~ '^[A-Z]{3}$')` keeps it a code. Existing projects keep
  their value: those already connected to Meta match their account; the others keep the
  currency they were given until an integration supplies one.
- **Keep the API field name `budgetCurrency`** (now `string | null`) to avoid touching every
  reader; only inputs drop it. Zod's default stripping makes a sent currency ignored.
- **Adopt on connect, refuse only with conflicting figures.** Connect writes the account's
  currency in the same transaction as the connection. It refuses when the currency differs
  and `CampaignDailyMetric` holds a row for the project: those figures are in the old
  currency, and relabelling them would misstate them. The import job's lock check stays as
  the guard against a race between connect and import.
- **Web formatting takes `string | null`.** Known codes keep their signs (`Br`, `₽`, `$`,
  `€`); others use `Intl.NumberFormat` with `currencyDisplay: "narrowSymbol"`; `null` shows
  the number alone.

## Risks / Trade-offs

- [A project that never connects an integration shows amounts without a currency] →
  intended; it has no imported figures to state.
- [KPI money targets set before the currency changes keep their number] → only possible
  for a project with no figures, where a target is rare; not converted.

## Migration Plan

One Prisma migration as above; existing data survives. Rollback restores the enum only for
rows holding one of the four codes.
