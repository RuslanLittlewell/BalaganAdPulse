## Context

See `proposal.md`. `add-role-registration-and-portals` built `/regustration/:code`, and
`add-client-side-staff` added a third kind to it. `/signup` predates both and was never
updated: it posts a name, an email, a password and a hand-typed code.

## Goals / Non-Goals

**Goals**

- One way in, and it is the one that knows which form to show.
- No bookmark that lands on nothing.

**Non-Goals**

- Changing what the API requires. It already refuses a registration without a redeemable
  invitation, which is why removing the screen is safe.
- Removing `POST /api/auth/register`. It is what every invitation form posts to.

## Decisions

### `/signup` redirects rather than disappearing

To the sign-in form, following the redirects `/clients/*` and `/team` already have. A
route that simply vanishes renders the shell with an empty pane, which reads as a page
that failed rather than one that moved.

### The removal is of a screen, not of a rule

Worth stating because it is easy to read the other way: the invitation requirement lives
in the API and is tested there. This change removes the *second* way of satisfying it —
the one that could only satisfy it for employees.

## Risks / Trade-offs

- [Somebody holding a code and no link cannot use it] → The link is the code: the
  invitation's `registrationUrl` is what an admin copies, and it carries the code in it.
  A bare code was never something the product handed out on its own.

## Migration Plan

No data and no schema. Deploying is enough.
