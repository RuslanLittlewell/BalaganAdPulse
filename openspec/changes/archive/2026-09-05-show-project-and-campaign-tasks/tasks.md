Every implementation task follows TDD: add the focused failing test, observe it fail, then add the
minimum implementation.

## 1. Listing a campaign's tasks

- [x] 1.1 Write the failing application tests for filtering the listing by campaign, including that it never widens reach.
- [x] 1.2 Filter by campaign in the use case and the repository.
- [x] 1.3 Write the failing HTTP tests for the campaign query parameter.
- [x] 1.4 Accept the parameter in the route.
- [x] 1.5 Run `npm test` — green.

## 2. The web entity

- [x] 2.1 Write the failing tests for the stage constant and the campaign-filtered list hook.
- [x] 2.2 Add the in-flight stages to the task entity and the campaign filter to the hook.
- [x] 2.3 Run `npm run test:web` — green.

## 3. Keeping a filtered listing filtered

Found while implementing section 2: a task event is folded into every cached listing
regardless of what that listing was filtered by. Latent until now, because the only
listing in use was the unfiltered board; with a campaign list on screen it shows other
campaigns' tasks the moment anyone creates one.

- [x] 3.1 Write the failing tests for an event about a task outside the listing's filter, and for one that leaves the filter.
- [x] 3.2 Honour the listing's filter when folding an event into it.
- [x] 3.3 Apply it at both call sites: the socket and the optimistic move.
- [x] 3.4 Run `npm run test:web` — green.

## 4. Reading a task without changing it

- [x] 4.1 Write the failing tests for the read-only description: it renders the document and refuses input.
- [x] 4.2 Add the editable flag to the description component.
- [x] 4.3 Write the failing tests for the preview dialog: what it shows, that it names the whole-project case, and that it carries no control that writes.
- [x] 4.4 Implement the preview dialog.
- [x] 4.5 Add the Russian strings.
- [x] 4.6 Run `npm run test:web` — green.

## 5. The two screens

- [x] 5.1 Write the failing tests for the task list component: rows, empty state, opening a row.
- [x] 5.2 Implement the task list.
- [x] 5.3 Write the failing tests for the project screen: in-flight tasks below the campaigns, done and archived left out, opening one.
- [x] 5.4 Show the list on the project screen.
- [x] 5.5 Write the failing tests for the campaign screen: the campaign's own tasks, and none of the project's others.
- [x] 5.6 Show the list on the campaign screen.
- [x] 5.7 Run `npm run test:web` — green.

## 6. Acceptance

- [x] 6.1 Update the README where it describes the task board.
- [x] 6.2 Run `openspec validate show-project-and-campaign-tasks --strict`.
- [x] 6.3 Run `npm test`, `npm run test:web`, `npm run build`, `npm run build:web` — all green.
