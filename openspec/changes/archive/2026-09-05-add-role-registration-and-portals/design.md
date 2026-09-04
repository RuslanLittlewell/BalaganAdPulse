## Context

See `proposal.md`. `consolidate-contact-book-invitations` typed invitations and built the
public resolver, but left the client form and client redemption as explicit non-goals.
`add-task-board` refused the board to `CLIENT` and said the portal change would decide
what a customer sees. This change closes both.

Existing pieces this builds on: the avatar editor (upload or generate, storing an
`avatarPath` JSON alongside the PNG), transactional employee redemption through the
identity and membership ports, `ClientAccess` grants, and the permission matrix shared by
the API and the web app.

## Goals / Non-Goals

**Goals**

- One link, two forms, decided by the invitation rather than by the visitor.
- Registration that either completes entirely or leaves nothing behind.
- A board that shows a member their own work.
- A client portal that is a narrowing of what exists, not a second set of screens.

**Non-Goals**

- Letting a client edit or delete a task, change its visibility, or write anything else.
- Email delivery of invitations. The link is still copied by hand.
- Notifying anyone when a client raises a task. It appears on the admin's board; a
  notification is a separate change.
- Reworking the board's columns or drag-and-drop for the client. They get the same board,
  narrowed.

## Decisions

### Signing out clears the session marker in the browser, not only on the server

The browser decides whether a session exists from a local marker and a non-HttpOnly
`adpulse_session` cookie; the refresh token itself is HttpOnly and only the server can
clear it. Signing out therefore has two halves, and the local half must run even when the
request carrying the server half fails — otherwise a member who asked to leave is still
inside.

**Diagnosed.** Two defects, both real, either of which strands a member inside a session
they asked to leave:

1. `endSession()` returned early when `hasSession()` was already false. That guard exists
   for a genuine case — two requests that 401 at the same moment must not tear down twice
   — but it reads the very markers a sign-out removes, and a *successful* sign-out clears
   the session cookie server-side in its own response. On a browser holding only that
   cookie (Safari clears localStorage by itself after a week idle) the teardown was
   skipped: nothing cleared the screen and nothing navigated to the sign-in form.

2. `clearTokens()` removed the localStorage marker but never the `adpulse_session` cookie.
   That cookie is deliberately readable, so the browser can expire it — and must, because
   the request that would have cleared it server-side is exactly the one that may fail.
   Left behind, it keeps `hasSession()` true, and the route guard readmits.

The fix keeps the guard for the reactive path and gives the deliberate one its own:
`endSession({ force: true })` from sign-out, which is the ending rather than a reaction to
one. `clearTokens()` now expires the cookie too.

### Visibility is a rule in the tasks module, applied after reach

Reach answers "which projects may this member look at" and is decided by grants. This new
rule answers "whose work is this" and is decided by the role plus the task's own
`assigneeId` or `createdById`. They compose in one direction only: the visibility rule can
take rows away from what reach allowed, never add any.

Written as one filter in the repository rather than a check per endpoint, so the listing,
the single read, the project screen's list and the campaign screen's list cannot disagree
about what exists. A task outside it answers 404, matching how every other unreachable row
in this API behaves.

### A manager sees only what they are responsible for, and triage is the admin's job

No exception, including for work a client raises. The consequence is sharp and deliberate:
**a task with nobody responsible is invisible to every manager and guest**, including the
one who just created it.

That is not a gap to work around — it is the workflow. A client's request lands on the
admin's board, the admin reads it and makes somebody responsible, and only then does it
appear for that person. One queue, one person triaging it, and nothing half-owned sitting
where several people can each assume somebody else has it.

What it costs: an admin who never opens the board leaves client requests unseen. There is
no notification in this change, so that is worth knowing before it happens.

### Visibility to the client is a stored mark, set once at creation and changed by admins

A separate boolean rather than deriving it from `createdById`. Deriving looked cheaper and
is wrong: the requirement is that an admin can make an *agency* task visible, and who
raised a task is a fact that must not change when somebody decides to share it. Two
different questions — "who raised this" and "is the customer shown this" — need two
fields, or answering one would corrupt the other.

Set automatically when a client raises a task, and changed afterwards only by an admin. A
manager may create, edit and complete a task but not decide what a customer is shown: that
is one decision, made in one place, by the role that answers for the relationship.

The client's own rule then reads off that single mark rather than off two conditions —
`visibleToClient` and reach, nothing more — which also behaves correctly when a client
record has more than one member.

### Client registration is one transaction across three modules

Identity creates the user, members create the membership and the grant, clients create the
client record, projects create the project, and invitations mark the code spent. All of it
shares the transaction the existing employee redemption already uses, extended with the
client and project writes through ports the identity module owns and the other modules
implement — the same shape as the project-grant port employee redemption already uses.

Half-finished registration is the failure worth designing against: a user with no client,
or a client with no project, would need an operator to clean up by hand.

### The client's screens are the existing screens, narrowed

The dashboard, the projects module and the task module already draw whatever the API
returns for the caller. With reach narrowing them to one client and the visibility rule
narrowing the board, a client opening them sees their own. No client-only screen is built;
the navigation hides what their role cannot read, as it already does.

## Risks / Trade-offs

- [A client's request waits until an admin triages it] → Intended, and the reason the rule
  has no exception. The risk is silence: nothing tells an admin a request arrived. If that
  bites, a notification is the fix, not a widening of the visibility rule.
- [An admin can share a task whose description holds internal notes] → Sharing is one
  deliberate action on one task, and the description is shown as written. Worth a word in
  the interface next to the control rather than a rule in the API.
- [Client registration writes across four modules in one transaction] → It is the same
  transaction employee redemption already spans; the addition is two more ports. The
  alternative — writing them in sequence — is exactly the half-made state to avoid.
- [Opening `task.read` to `CLIENT` widens the matrix] → The verb widens; reach does not.
  A client still reaches only their own client's rows, and the visibility rule narrows
  further to what they raised. Both are tested.
- [A client's password lives in a form step that also holds contact details] → Noted in
  the proposal as an assumption, because the described steps carried no credentials at
  all. If the account should instead be created from the invitation's email with a
  set-password link, that is a different change and a bigger one.

## Migration Plan

One additive migration: a `visible_to_client` boolean on `task`, defaulting to false.
Every existing task becomes the agency's own, which is what all of them are — no client
has ever been able to see one. `assigneeId` and `createdById` already exist, and clients
and projects already have their tables. Existing members keep their grants.

The visibility rule takes effect the moment the API deploys — a manager's board narrows
without warning. Worth telling the team before the deploy rather than after, since work
that was visible in the morning will not be in the afternoon.

Rollback is the previous API: nothing written by the new registration is invalid under it,
and a client member simply loses task access again.
