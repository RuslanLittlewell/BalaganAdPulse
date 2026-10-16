## Why

A project carries a niche and a monthly budget that nothing in the product acts on. The
budget is never compared against the spend the agency actually measures, never summed into
a figure anybody reads, and never drives a KPI — it is typed once and then only re-displayed.
The niche is a subtitle. Both cost a field in every form that makes a project, including the
client's own self-registration, and both have to be carried through the API, the domain and
the database to end as decoration.

The project form has also outgrown its shape: it puts the picture in the same single column
as the fields, so the dialog reads as one long list rather than as an object with a face.

## What Changes

- **BREAKING** A project no longer carries a niche or a monthly budget. Both are dropped from
  the database, the API, and every screen that shows or writes them.
- The project create/edit form and the client self-registration wizard lose both fields.
- The project header under the title, which read `client · niche · budget / мес.`, now names
  the client alone. The dashboard's project table loses the niche line under each project
  name, and the invitation dialog's project cards lose their niche subtitle.
- **The currency stays.** It is not the budget's currency: it is the currency the project's
  measured figures are stated in — spend, CPM, CPC, CPA and the KPI tile on the project,
  campaign and dashboard screens — and the value the Meta integration refuses to import
  against when an ad account disagrees. Its picker stays in both forms; what changes is what
  it is called and what the spec says it is for.
- The project form is laid out in two columns, 20/80: the picture and the control that
  changes it in the narrow column, the fields in the wide one, as the profile form already
  does.

## Capabilities

### Modified Capabilities
- `project-management`: the requirement that defines the budget and its currency is replaced
  by one that defines only the currency a project's figures are stated in, keeping every rule
  the integration and the formatters depend on; the requirement covering what a customer may
  edit stops naming the removed fields.
- `access-control`: the requirement granting a client authority over their own client's
  projects stops naming the removed fields among what they may edit.

## Impact

- **API** (`apps/api`): a migration drops `project.niche` and `project.monthly_budget` and
  keeps `budget_currency`; the project domain record, the Zod create/update schemas, the
  OpenAPI component and its tag description, and the Prisma repository's `toDomain` all lose
  the two fields — with them goes the only `Prisma.Decimal` conversion in that repository. The
  client-registration chain (`identity-schemas`, `invites/ports`) loses them from its project
  payload; the composition spreads carry them implicitly and only need verifying.
- **Web** (`apps/web`): `ProjectFormDialog` (fields and layout), `ClientRegistrationForm`'s
  project step, `ProjectHeader`, `ProjectPerformanceTable`, `InvitationDialog`, the `Project`
  and `ProjectInput` shapes, the registration request body, and `ru.ts`.
- **Data**: existing niches and budgets are dropped by the migration. Accepted — the fields are
  going away, not being hidden.
- **Untouched by design**: everything under `apps/api/src/modules/integrations/**`, which reads
  the currency and never the budget; the KPI module; the project list widgets; all seed files.
