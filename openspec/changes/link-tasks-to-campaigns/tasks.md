Every implementation task follows TDD: add the focused failing test, observe it fail, then add the
minimum implementation.

## 1. Storing the link

- [x] 1.1 Write the failing repository tests for creating and updating a task with and without a campaign.
- [x] 1.2 Write the failing test proving a deleted campaign leaves its tasks standing, with no campaign.
- [x] 1.3 Add the nullable `campaignId` to `Task` with `ON DELETE SET NULL`, and the migration.
- [x] 1.4 Carry the field through the task record, its ports and the Prisma adapter.
- [x] 1.5 Run `npm test` — green.

## 2. The agreement between project and campaign

- [x] 2.1 Write the failing application tests for naming a campaign of the task's own project.
- [x] 2.2 Write the failing tests for a campaign of another project, an unknown campaign, and an unreachable one.
- [x] 2.3 Write the failing tests for changing the project alone, and for changing both together.
- [x] 2.4 Add the `CampaignReach` port and validate the resulting campaign against the resulting project.
- [x] 2.5 Implement the adapter and wire it in the composition root.
- [x] 2.6 Run `npm test` — green.

## 3. The HTTP surface

- [x] 3.1 Write the failing HTTP tests for creating, updating and reading a task's campaign.
- [x] 3.2 Accept `campaignId` in the create and update schemas, nullable and optional.
- [x] 3.3 Write the failing tests for the campaign reference listing, including an unreachable project.
- [x] 3.4 Implement the reference listing and mount it.
- [x] 3.5 Run `npm test` — green.

## 4. The task form

- [x] 4.1 Write the failing entity tests for the campaign field and the reference-list hook.
- [x] 4.2 Add the field to the task contracts and the campaign-names hook.
- [x] 4.3 Write the failing form tests: the select appears once a project is chosen, defaults to Общий, and saves the choice.
- [x] 4.4 Write the failing test proving changing the project clears the campaign.
- [x] 4.5 Implement the campaign select in the task form dialog.
- [x] 4.6 Add the Russian strings.
- [x] 4.7 Run `npm run test:web` — green.

## 5. Showing it on the board

- [x] 5.1 Write the failing card test proving a task names its campaign, and Общий when it has none.
- [x] 5.2 Show the campaign on the card.
- [x] 5.3 Run `npm run test:web` — green.

## 6. Acceptance

- [x] 6.1 Update the README where it describes a task.
- [x] 6.2 Run `openspec validate link-tasks-to-campaigns --strict`.
- [x] 6.3 Run `npm test`, `npm run test:web`, `npm run build`, `npm run build:web` — all green.
