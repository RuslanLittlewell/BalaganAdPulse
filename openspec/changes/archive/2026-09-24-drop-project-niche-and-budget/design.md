## Context

See proposal.md for motivation. What shapes the approach:

`Project` carries three related columns — `niche`, `monthlyBudget` and `budgetCurrency`. They
read as one group and were introduced as one, which makes it tempting to remove all three.
Only the first two are inert.

The client self-registration wizard's second step is a project form: it posts a `project`
object that really does become a `Project` row, through
`identity-schemas` → `invites/ports` → `projectDirectory.create`. Any field removed from the
project form has to be removed there too, or registration starts sending a field the API no
longer accepts.

`ProfileSettingsDialog` already lays a form out as a narrow picture column beside a wide field
column. The project form is to follow it, at 20/80 rather than the profile's fixed 180px.

## Goals / Non-Goals

**Goals:**
- Remove the niche and the monthly budget from the schema, the API, every form and every
  display, leaving no dead column, field, string or fixture.
- Keep every rule about the currency that other features depend on, while changing what the
  currency is said to be for.
- Give the project form the two-column shape the profile form has.

**Non-Goals:**
- Removing or hiding the currency, its picker, or the `Currency` enum.
- Touching the Meta integration, the KPI module, or anything that formats figures.
- Applying the 20/80 layout to any other dialog.

## Decisions

**The currency survives, and stops being the budget's.** It has four uses that never involve a
budget: it formats the spend, CPM, CPC, CPA and KPI figures on the project page, the campaign
page and the dashboard's per-project rows; and the Meta integration refuses to connect or
import an ad account whose currency differs from the project's, re-checking it under a row
lock at commit time. `meta-project-integration` requires that refusal in writing, so the field
is load-bearing beyond this capability. Alternative considered: drop the currency with the
budget and let everything fall back to the default. Rejected — every project would be pinned
to `BYN`, a USD or EUR ad account could never be connected again, and the dashboard would
state every agency's spend in one currency regardless of what was billed. The only line where
the currency exists *because of* the budget is the header's formatted amount, and that line
goes with the budget.

**The picker stays in both forms.** It follows from the above: a currency nobody can set is a
currency permanently equal to its default. What changes is the wording around it — it is no
longer introduced as part of a budget row.

**Replace the budget requirement rather than editing it.** The existing requirement bundles the
budget with the currency contract. Its scenarios about storing and showing an amount die; its
rules about always carrying a currency, never inferring it, defaulting to `BYN` and refusing a
fifth currency must survive verbatim in force. This OpenSpec build refuses a `MODIFIED`
requirement that drops a scenario the current spec still has, and refuses the same requirement
name under both `ADDED` and `REMOVED` — so the replacement is a `REMOVED` plus an `ADDED`
under a new name that says what the currency is now for.

**The header's " / мес." suffix disappears with its source.** `ProjectHeader` builds the suffix
by string-splitting the translated label — `t("project.budget.label").split("/")[1]` — so that
ru key is load-bearing for the header and not only for the form. Both go together; there is no
separate suffix string to keep.

**Each display surface degrades to fewer values, never to an empty container.** The header's
fact line is `[client, niche, budget].filter(Boolean).join(" · ")` and becomes the client
alone. The dashboard's niche is a `note` rendered behind a null guard, not a column, so no
header is left behind. The invitation card's niche subtitle is already guarded. Nothing needs
an empty state it did not have before.

**Both forms lose a two-column row that would otherwise hold one child.** The project form's
`grid sm:grid-cols-2` currently holds the niche, the budget and the currency; the registration
step's holds the niche and the budget beside the currency. Removing two children from a
two-column grid leaves a lopsided row, so the surviving currency select is placed in the new
single-column field stack rather than left alone in a grid.

**The project form's picture column is 20/80 and stacks on narrow screens.** It mirrors the
profile form — centred picture, caption, full-width button, a right border dividing it from
the fields — with `sm:grid-cols-[1fr_4fr]` for the proportion the user asked for. The ratio
itself is presentation, so it is recorded here and in tasks.md rather than as a spec
requirement: the capability's specs describe what a project is and who may change it, and
nothing observable beyond styling distinguishes 20/80 from any other split. The project's
testing convention forbids asserting on CSS, so there is deliberately no test for the ratio.

## Risks / Trade-offs

[Someone later reads "the budget is gone" and removes the currency with it] → Mitigated by the
new requirement naming what the currency is for, and by this document citing the integration
spec that depends on it. The backend test that changes a project's currency mid-import and
expects a `CURRENCY` refusal is the regression guard and must keep passing untouched.

[Stored niches and budgets are lost when the migration runs] → Intended, and stated in the
proposal. If this has already reached an environment whose data matters, run the migration in
a window rather than against live traffic, as with any column drop.

[Four backend tests use the niche and the budget as the payload that proves something else —
that an update round-trips, that changing the priority leaves the rest alone] → They need a
surviving field to carry that role rather than deletion, or they stop proving anything. Called
out per-test in tasks.md so they are rewritten rather than dropped.

## Migration Plan

1. Drop `niche` and `monthly_budget` from `project` in one migration; leave `budget_currency`.
2. Shrink the backend types outward from the domain record, so the compiler finds the call
   sites: domain → Zod schemas → OpenAPI → repository → the registration chain.
3. Then the frontend, entity shapes first, then the three display surfaces, then the two forms.
4. Remove the two ru keys with the code that reads them, plus the two already-dead ones beside
   them.
5. No rollback beyond `git revert` and a down-migration; this is planning-only until an
   explicit apply request.
