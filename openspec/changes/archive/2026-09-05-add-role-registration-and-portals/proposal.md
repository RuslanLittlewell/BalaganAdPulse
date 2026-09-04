## Why

An invitation already knows whether it is for a client or an employee — the backend
stores the type, and `GET /api/regustration/:code` answers it publicly. Nothing consumes
that answer: there is one signup form asking for a name, an email, a password and a code,
and no client can complete registration at all.

What each role sees afterwards is also unfinished. An employee sees every task on every
project they are granted, which is more than their own work. A client is refused the task
board outright — a deliberate placeholder from `add-task-board`, which said the portal
would decide later what a customer sees. This is that decision.

And signing out does not finish: the session is not reliably ended and the person is left
on the screen they were on rather than at the sign-in form.

## What Changes

- Signing out ends the session and lands on the sign-in form, every time.
- `/regustration/:code` resolves the invitation's type and shows the matching form.
- **Employee form**: name, email, password, password confirmation, and an avatar —
  uploaded or generated.
- **Client form**, two steps: the contact's own fields with an avatar, then a project
  with its own fields and picture. Completing it creates the account, the client record
  and the first project together, or none of them.
- An employee sees only the tasks they are responsible for — with no exception, so a task
  nobody is responsible for waits on an admin's board until an admin hands it to someone.
- A task records whether it is visible to the client. A client's own is marked so when
  they raise it; the agency's own is not, and only an admin may change that.
- A client reaches the task module and sees the tasks marked visible to them.
- A client reaches their own projects and a dashboard covering them.
- **BREAKING for managers and guests**: the board stops showing colleagues' tasks, and
  stops showing unassigned ones.

## Capabilities

### Modified Capabilities

- `registration-invitations`: two typed registration forms, and client redemption that
  creates the client and its first project in one transaction.
- `task-board`: what a member sees narrows from "every task I reach" to "the work that is
  mine", and a task gains a mark saying whether the client is shown it.
- `access-control`: a client role reaches the task module, narrowed to its own rows.
- `organization-membership`: signing out ends the session and returns to the sign-in form.

## Impact

- `apps/api`: client invitation redemption creating a client and a project atomically;
  a `visibleToClient` column on `task` and its migration; a visibility rule in the tasks
  module; the permission matrix gains client task access.
- `apps/web`: the `/regustration/:code` route and its two forms, the avatar step, the
  admin-only "visible to the client" control on the task form, the client's project and
  dashboard screens, and the sign-out path.
- `packages/access-policy`: `task.read` opens to `CLIENT`.

## Confirmed with the requester

- The client form is **two steps**: the client's own account first, then the project they
  create. The first step carries a password and its confirmation alongside the contact
  fields, since an account that cannot be signed into is not an account; email doubles as
  the login, as it does for an employee.
- A manager sees **only** the tasks assigned to them, with no exception for client-raised
  work. A client's request therefore waits on the admin's board until an admin assigns it
  — that triage is the intended workflow, not a gap.
- Only an **admin** decides whether a task is visible to the client.
