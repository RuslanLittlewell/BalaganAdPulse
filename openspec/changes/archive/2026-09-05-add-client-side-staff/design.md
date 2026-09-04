## Context

See `proposal.md`. Today a customer is exactly one membership with the `CLIENT` role and a
`ClientAccess` grant. `add-role-registration-and-portals` built the portal around that
single account, and the contact book has just been corrected so customers no longer appear
among the agency's employees — leaving a client's own people with nowhere to live.

Invitations already carry a type (`CLIENT`, `EMPLOYEE`), a code, an optional role and a set
of projects, and are issued and listed by admins alone.

## Goals / Non-Goals

**Goals**

- A client's people reach exactly what the client reaches, and nothing else.
- Administering them is the client's own job, without giving them anything else to write.
- One rule for what a customer sees, whichever of the two roles they hold.

**Non-Goals**

- Letting a customer change a project, a campaign or a client record. Nothing about
  reading widens here.
- Per-person project scoping inside a client. Everyone on a client reaches all of that
  client's projects; if that ever needs narrowing, `ClientAccess` already carries a project.
- Transferring the principal, or having several. Exactly one account administers a client's
  people, and it is the one that registered it.
- Email delivery. Links are still copied by hand.

## Decisions

### A second role rather than a flag on the membership

`CLIENT_ADMIN` joins the matrix beside `CLIENT`. The difference between the two is exactly
a set of verbs — invite, revoke, remove — and the matrix is where this system already
answers "which verbs may this role use". A boolean would put the same answer somewhere
else, and every caller would have to remember to consult both.

Its name is scoped on purpose: it administers *its client's* people. Its reach is one
client, identical to `CLIENT` — nothing about being a principal widens what it can see.

### The invitation names the client it joins, and reach is checked against the issuer

A `CLIENT_STAFF` invitation carries a client id. An agency admin may name any client in
the organization; a `CLIENT_ADMIN` may name only their own, and naming another answers the
way a client that does not exist answers — a principal must not be able to enumerate the
agency's other customers by watching which ids are refused.

Listing and revoking follow the issuer the same way, so a principal sees their own
outstanding invitations and nothing more.

### Registration makes the first person the principal

Somebody has to be able to add the second. The account created by the two-step client
registration is that person, and there is no ceremony for promoting anyone later — a
client with nobody who can invite would need an operator, which is exactly the state this
change exists to avoid.

Existing client accounts migrate to `CLIENT_ADMIN`: each is currently the only person on
its client, so each is already its principal in everything but name.

### Both customer roles answer the same question about tasks

The visibility rule keys on "is this actor a customer", not on which of the two roles they
hold. The second role administers people; it has no more claim on the agency's internal
work than the first. Writing it as one predicate keeps the two from drifting the first
time either changes.

The same is true of the staff listing: `?kind=staff` means the agency's own people, so it
excludes both customer roles. Stated as the exclusion it already is, so a customer role
added later is excluded by default rather than silently appearing among employees — which
is the bug this follows.

## Risks / Trade-offs

- [A principal can add people who see the client's figures] → That is the feature. The
  agency retains the decision about what a customer is shown at all, through the
  visible-to-client mark on each task; adding a colleague does not widen it.
- [Two customer roles double the places a role is checked] → Mitigated by asking "is this a
  customer" in one predicate rather than comparing role names at each site. Every existing
  `role === "CLIENT"` check becomes that predicate, which is the bulk of the work.
- [A principal who leaves takes the ability to invite with them] → Real, and out of scope
  by the decision above. The agency admin can still issue the invitation, which is why
  both sides can.

## Migration Plan

One additive migration: `CLIENT_ADMIN` joins the `Role` enum, and every existing
`CLIENT` membership becomes one. Each is currently the only account on its client, so the
promotion changes nothing anybody can see except that they can now add a colleague.

An invitation gains a nullable client id, set only for the new type and null for the two
that exist.

Rollback removes the role from the matrix; memberships holding it would have to be moved
back to `CLIENT` before the enum value can be dropped, so the enum value is worth leaving
in place until the change is known to stick.
