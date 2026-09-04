Every implementation task follows TDD: add the focused failing test, observe it fail, then add the
minimum implementation.

## 1. The second customer role

- [x] 1.1 Write the failing matrix tests: `CLIENT_ADMIN` reads what `CLIENT` reads, raises a task, administers invitations and members, and writes nothing else.
- [x] 1.2 Add `CLIENT_ADMIN` to the roles and its row in the matrix.
- [x] 1.3 Add the role to the Prisma enum, with a migration promoting every existing `CLIENT` membership to it.
- [x] 1.4 Write the failing tests for the one predicate that answers "is this actor a customer".
- [x] 1.5 Replace every `role === "CLIENT"` comparison with it: task visibility, the task mark on creation, and the staff listing.
- [x] 1.6 Run `npm test` — green.

## 2. Reaching one client, whichever role

- [x] 2.1 Write the failing tests: a `CLIENT_ADMIN` reaches its own client's projects, campaigns and figures, and nothing else.
- [x] 2.2 Write the failing test proving neither customer role may write a client, project or campaign.
- [x] 2.3 Make the reach filters treat both roles alike.
      No change was needed: the filters send everyone but an admin down the grants path, so
      the new role reached correctly by construction. The tests now say so.
- [x] 2.4 Run `npm test` — green.

## 3. An invitation that joins an existing client

- [x] 3.1 Write the failing application tests for the third registration type, including that it carries a client and no role.
- [x] 3.2 Add the type and the nullable client id, with the migration.
- [x] 3.3 Write the failing tests for who may issue one: an admin for any client, a principal only for their own, and the refusal being indistinguishable from an unknown client.
- [x] 3.4 Write the failing tests for listing and revoking following the same rule.
- [x] 3.5 Implement issuing, listing and revoking against the issuer's reach.
- [x] 3.6 Write the failing tests for redemption: the account, the enrolment and the grant land together, or nothing does.
- [x] 3.7 Implement redemption.
- [x] 3.8 Run `npm test` — green.

## 4. The joining form

- [x] 4.1 Write the failing tests for the resolver answering the third type.
- [x] 4.2 Write the failing tests for the form: name, email, password and its confirmation, an avatar, and nothing about a company.
- [x] 4.3 Implement the form and route it from the registration page.
- [x] 4.4 Add the Russian strings.
- [x] 4.5 Run `npm run test:web` — green.

## 5. Where a client's people are listed

- [x] 5.1 Write the failing tests for the agency's view: a client's people on the client, and none of them among the employees.
- [x] 5.2 Add the client's people to the client pane of the contact book.
- [x] 5.3 Write the failing tests for the customer's own view: who is on the company, and the invitation controls only for the principal.
- [x] 5.4 Implement the customer's own directory.
- [x] 5.5 Write the failing test proving an ordinary customer is offered no control that invites or removes.
- [x] 5.6 Run `npm run test:web` — green.

## 6. Acceptance

- [ ] 6.1 Walk it end to end against a running API: a client registers, invites a colleague, the colleague joins and sees the same tasks.
      Covered by API tests against Postgres; a browser walk-through is still worth doing.
- [x] 6.2 Confirm an admin can issue the same invitation, and that a principal cannot name another client.
- [x] 6.3 Update the README on roles, registration and what each sees.
- [x] 6.4 Run `openspec validate add-client-side-staff --strict`.
- [x] 6.5 Run `npm test`, `npm run test:web`, `npm run build`, `npm run build:web` — all green.
