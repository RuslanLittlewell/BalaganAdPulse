## Context

`Project.monthlyBudget` is a `Decimal(12,2)` with no currency beside it. The web app
formats it with `formatCurrency`, which is hard-coded to roubles — so a Belarusian
client's budget has been displayed in the wrong currency for as long as the field has
existed.

## Goals / Non-Goals

**Goals**

- An amount that cannot be read as the wrong currency.
- One list of currencies, shared by the API and the web app.

**Non-Goals**

- Converting between currencies, or storing a rate. A budget is stated once, in one
  currency, and read back in it.
- Giving measured spend a currency. That figure comes from the platform's ad account and
  is a separate question — see the proposal.
- A per-organization default beyond `BYN`.

## Decisions

### The currency is a column on the project, not on the amount

Postgres has no money-with-currency type worth using here, and a second table for four
constants would be a join for nothing. An enum column beside the amount says exactly what
is true: this project's budget is stated in this currency.

### It is never null, even when the amount is

A project with no budget still has a currency, defaulting to `BYN`. The alternative —
null until an amount is entered — makes every reader handle a case that means nothing,
and makes entering an amount a two-field decision when it should be one.

### `formatCurrency` takes the currency it is to use

Its rouble sign was a default nobody chose; it was the only currency at the time. It now
takes one, keeping `RUB` as the parameter default so the metric screens — which show ad
spend, a separate question — are unchanged by this.

## Risks / Trade-offs

- [Existing budgets get a currency they were never entered in] → Every project in the
  database is Belarusian and its budgets were entered as roubles-or-BYN with no way to
  tell. `BYN` is the honest default for this agency; a project whose budget was meant as
  something else has to be corrected once, and there are few of them.
- [Spend and budget now format differently] → Deliberate and stated in the proposal. They
  are different figures; showing both in one currency was the thing that was wrong.

## Migration Plan

One additive migration: a `Currency` enum and a `budget_currency` column on `project`,
NOT NULL, defaulting to `BYN`. Every existing project takes the default. Rollback drops
the column; budgets become bare numbers again.
