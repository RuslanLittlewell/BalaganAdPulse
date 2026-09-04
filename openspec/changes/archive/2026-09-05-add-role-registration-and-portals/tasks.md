Every implementation task follows TDD: add the focused failing test, observe it fail, then add the
minimum implementation.

## 1. Signing out

- [x] 1.1 Write the failing tests: signing out lands on the sign-in form, ends the session, and does so even when the revoke request fails.
- [x] 1.2 Diagnose why the session survives today, and state the cause in the change before fixing it.
      Two defects, both recorded in `design.md`: `endSession()` guarded on `hasSession()`, which
      reads the very markers a sign-out removes; and `clearTokens()` cleared the localStorage
      marker but never the readable `adpulse_session` cookie.
- [x] 1.3 Fix the sign-out path so both halves run, and prove the next sign-in on the same browser sees its own data.
- [x] 1.4 Run `npm run test:web` — green.

## 2. Marking a task visible to the client

- [x] 2.1 Write the failing repository tests for storing and reading the mark, defaulting to the agency's own.
- [x] 2.2 Add `visibleToClient` to `Task` with its migration, defaulting to false.
- [x] 2.3 Write the failing application tests: a client's task is marked on creation, anybody else's is not.
- [x] 2.4 Write the failing tests proving only an admin may change the mark, and that a manager and a client are refused with 403.
- [x] 2.5 Write the failing test proving changing the mark leaves the responsible member and the stage untouched.
- [x] 2.6 Carry the field through the ports, the use cases, the schemas and the HTTP surface.
- [x] 2.7 Run `npm test` — green.

## 3. What a member sees on the board

- [x] 3.1 Write the failing application tests: an admin sees everything, a manager and a guest only what they are responsible for, a client only what is marked visible to them.
- [x] 3.2 Write the failing test proving an unassigned task is invisible to a manager and visible to an admin, and appears once an admin assigns it.
- [x] 3.3 Write the failing test proving another member's task answers 404, not 403, when opened directly — including a client opening an agency task on their own project.
- [x] 3.4 Add the visibility rule to the tasks module, applied after reach and never widening it.
- [x] 3.5 Write the failing repository tests for the same rule in the listing query.
- [x] 3.6 Apply it to the listing, the single read, and the project and campaign lists.
- [x] 3.7 Found while implementing: the socket delivered events by role alone, so the rule had to
      reach it too — a customer would have received the agency's work without asking. The deletion
      event now carries who could see the task, for the same reason.
- [x] 3.8 Run `npm test` — green.

## 4. A client reaches the task module

- [x] 4.1 Write the failing matrix tests: `CLIENT` may read and create a task, and may not update or delete one.
- [x] 4.2 Open `task.read` and `task.create` to `CLIENT` in the permission matrix.
- [x] 4.3 Write the failing API tests for a client raising a task on a reachable project, and being refused an edit and a delete.
- [x] 4.4 Make the task use cases honour it.
- [x] 4.5 Run `npm test` — green.

## 5. Client redemption

- [x] 5.1 Write the failing application tests: redeeming a client invitation creates the account, the client and the project together.
- [x] 5.2 Write the failing test proving a failure at any point stores nothing and leaves the code usable.
- [x] 5.3 Add the client and project ports to the redemption transaction, implemented by their own modules.
- [x] 5.4 Write the failing HTTP tests for the client registration payload, including its validation.
- [x] 5.5 Extend the registration endpoint and its schema.
- [x] 5.6 Write the failing test proving an admin then sees the client's project and its tasks.
- [x] 5.7 Run `npm test` — green.

## 6. The registration route and the employee form

- [x] 6.1 Write the failing tests for `/regustration/:code`: it resolves the type, shows the matching form, and shows one message for every unusable code.
- [x] 6.2 Add the route and the type resolver hook.
- [x] 6.3 Write the failing tests for the employee form: the fields, the password confirmation, and the avatar step.
- [x] 6.4 Implement the employee form, reusing the avatar editor.
- [x] 6.5 Run `npm run test:web` — green.

## 7. The client form

- [x] 7.1 Write the failing tests for step one: the contact fields, the password confirmation, and the avatar.
- [x] 7.2 Write the failing tests for step two: the project fields and its picture.
- [x] 7.3 Write the failing test proving going back keeps what was typed.
- [x] 7.4 Write the failing test proving the form submits once, at the end, and reports a refusal without losing the steps.
- [x] 7.5 Implement the two-step client form.
- [x] 7.6 Add the Russian strings for both forms.
- [x] 7.7 Run `npm run test:web` — green.

## 8. What a client sees

- [x] 8.1 Write the failing tests: the navigation offers the modules a client may read and no others.
- [x] 8.2 Write the failing tests for a client's dashboard and projects module showing their own and nothing else.
- [x] 8.3 Write the failing test for a client's board showing the tasks marked visible to them, with no control that edits one.
- [x] 8.4 Write the failing tests for the admin-only "visible to the client" control on the task form: an admin sees it, a manager does not.
- [x] 8.5 Make the screens honour the client's role, and add the control with its Russian strings.
- [x] 8.6 Run `npm run test:web` — green.

## 9. Acceptance

- [ ] 9.1 Walk both registrations end to end against a running API and a real database.
      Covered by API tests against Postgres (`invite.lifecycle.api.test.ts`); a browser walk-through
      is still worth doing before this ships.
- [x] 9.2 Confirm an admin sees a client-registered project and the tasks raised on it, and that assigning one shows it to that manager.
- [x] 9.3 Confirm a task an admin marks visible reaches the client's board, and that unmarking it removes it.
- [x] 9.4 Update the README on registration, roles, and what each sees.
- [x] 9.5 Run `openspec validate add-role-registration-and-portals --strict`.
- [x] 9.6 Run `npm test`, `npm run test:web`, `npm run build`, `npm run build:web` — all green.
