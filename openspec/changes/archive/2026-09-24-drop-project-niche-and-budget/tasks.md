## 1. The columns go

- [x] 1.1 Drop `niche` and `monthlyBudget` from `model Project` in `schema.prisma`, keeping
  `budgetCurrency`, and write the migration that drops the two columns.

## 2. The backend stops carrying them

- [x] 2.1 Rewrite the backend tests that name the fields, and run them to see them fail:
  in `test/projects/project.api.test.ts` drop the create/update assertions on them, delete
  "keeps the budget exact, as a decimal rather than a float", give "updates a project" and
  "changes the priority on its own, without touching the rest" a surviving field to carry the
  role the niche and the budget played, and reduce `describe("the currency a budget is stated
  in")` to the two tests that are about the currency alone; in
  `test/projects/project.prisma-adapter.test.ts` delete the decimal-exactness test and rewrite
  the currency describe; in `test/projects/customer-projects.api.test.ts` rename and rewrite
  "lets a customer edit the name, niche, budget and currency…"; strip the fields from the
  fixtures in `test/projects/project.application.test.ts`,
  `test/invites/invite.lifecycle.api.test.ts` and `test/invites/invite.typed-application.test.ts`.
- [x] 2.2 Remove the two fields from `ProjectRecord` and `ProjectChange`
  (`modules/projects/domain/project.ts`), keeping `Currency`, `CURRENCIES`, `DEFAULT_CURRENCY`
  and the `budgetCurrency` members.
- [x] 2.3 Remove them from `createProjectSchema` (`project-schemas.ts`, which `.partial()`
  covers the update), from the OpenAPI component and the tag description that names the budget
  (`project-openapi.ts`), and from `toDomain` in `prisma-project-repository.ts` along with the
  `Prisma.Decimal` conversion that existed only for the budget.
- [x] 2.4 Remove them from the registration chain: the `project` object in
  `identity-schemas.ts` and `ClientRegistrationDetails.project` in `invites/application/ports.ts`,
  keeping `budgetCurrency` in both. Verify the `...details` spreads in
  `composition/create-container.ts` and `invites/application/invite-use-cases.ts` need no edit.
- [x] 2.5 Run `npm test` until the backend is green, and confirm
  `test/integrations/jobs.test.ts` — the currency guard — passes untouched.

## 3. The web stops reading them

- [x] 3.1 Rewrite the frontend tests that name the fields, and run them to see them fail:
  strip the two keys from the shared `aProject()` factory in `test/shared/fixtures.ts` and from
  the fixtures in `LeadFormDialog`, `guest-surfaces`, `DashboardPage`, `CampaignPage`,
  `TaskBoardLayout` and `ProjectPage` tests; in `test/pages/projects/ProjectsPage.test.tsx`
  reduce "shows the client and the niche beside the project name" to the client; in
  `test/widgets/project-list/ProjectList.test.tsx` drop the niche prefill assertion; in
  `test/widgets/contact-book/ContactBook.test.tsx` rename "draws each project as a card with
  its name and niche" and drop the niche assertion.
- [x] 3.2 Remove the fields from `Project` and `ProjectInput`
  (`entities/project/api/api.ts`) and from `ClientRegistrationBody.project`
  (`features/auth/api.ts`).
- [x] 3.3 Remove them from the three display surfaces: the fact line in `ProjectHeader.tsx`,
  the `note` in `ProjectPerformanceTable.tsx` (keeping `currency`), and the subtitle in
  `InvitationDialog.tsx`.
- [x] 3.4 Run `npm run test:web` until green.

## 4. The project form: the fields go and it is laid out 20/80

- [x] 4.1 Rewrite `test/features/project-management/ProjectFormDialog.test.tsx` and run it to
  see it fail: retitle and rewrite "asks for exactly the four things a project is described
  by", drop the niche and budget from "sends the name, the client and the numbers", delete
  "ignores keystrokes that would make the budget a non-number" and "clears an emptied niche
  rather than storing a blank", and rewrite the currency test that types an amount so it
  asserts the currency alone.
- [x] 4.2 Remove the niche field, the budget field with its `isPartialDecimal` filter, and
  their entries in `Fields`, `toInput()` and `defaultValues` from `ProjectFormDialog.tsx`,
  moving the surviving currency select out of the two-column row it shared with them.
- [x] 4.3 Lay the dialog out in two columns, `sm:grid-cols-[1fr_4fr]`, stacking on narrow
  screens: the picture and the control that changes it centred in the narrow column with a
  dividing right border, the fields in the wide one, following `ProfileSettingsDialog`.
- [x] 4.4 Run `npm run test:web` until green.

## 5. The registration wizard's project step

- [x] 5.1 Rewrite `test/pages/registration/ClientForm.test.tsx` and run it to see it fail:
  drop the niche and budget label assertions from "moves on to the project step", rewrite
  "sends the budget with the currency it was stated in" to assert the currency alone, delete
  "sends no amount when the budget is left empty", and drop the niche from the final payload
  assertion in "submits everything once, from the last step".
- [x] 5.2 Remove the niche and budget fields, the now-dead `amountOf()` helper, and their
  entries in `ProjectValues`, `defaultValues` and the payload from `ClientRegistrationForm.tsx`,
  leaving the currency select in a row that is not left holding one child.
- [x] 5.3 Run `npm run test:web` until green.

## 6. Strings and docs

- [x] 6.1 Remove `project.niche.label` and `project.budget.label` from `ru.ts`, keeping
  `project.currency.label`, and delete the already-dead `form.niche.label` and
  `form.budget.label` beside them.
- [x] 6.2 Reword the `## Purpose` of `openspec/specs/project-management/spec.md`, which names
  the niche and the monthly budget — a delta's Purpose is ignored on archive, so the main spec
  is edited directly. Update `README.md` where it lists a project's fields.

## 7. Close the change

- [x] 7.1 Run `npm test` and `npm run test:web` from a clean tree until both are green, then
  `npm run build -w apps/api` and `npm run build -w @adpulse/web`.
- [x] 7.2 Run `openspec validate drop-project-niche-and-budget --strict` and confirm the
  implementation matches every scenario in the delta specs.
