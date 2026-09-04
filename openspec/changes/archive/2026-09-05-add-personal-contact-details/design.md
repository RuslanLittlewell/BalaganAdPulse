## Context

See `proposal.md`. `User` holds the identity — name, email, password hash, avatar — and
`Membership` holds what the organization decides about them: role, status, grants. The
member directory reads both and returns a flat record.

## Goals / Non-Goals

**Goals**

- Contact details that belong to the person and travel with them.
- One place a person changes them, and it is their own profile.

**Non-Goals**

- Validating a phone number's shape. The agency works across several countries and the
  formats differ; a stored string somebody can read is worth more than a rejected one
  that was correct.
- A second Telegram-shaped identity, or messaging through it. It is a way of reaching
  somebody, written down.
- Letting an admin edit somebody else's details.

## Decisions

### The fields live on the user, not on the membership

They are the person's, and they do not change because the organization decided something
about them. A membership is what the organization says; a phone number is not.

### Optional, and shown as absent rather than blank

A registration that refused an account over a missing phone number would be trading a
member for a field. A directory row with nothing there reads as a gap in the layout; a
dash reads as a fact.

### Editable only by their owner

The profile endpoint already updates the signed-in person and nobody else, so these join
it rather than the member-administration endpoint. That is also why an admin cannot fix a
colleague's typo — worth stating, because somebody will ask.

## Risks / Trade-offs

- [An unvalidated phone can be stored malformed] → Accepted, and preferred: the formats
  vary by country and a refusal would be wrong more often than a bad string is harmful.
  Nothing dials it; a person reads it.
- [Three registration forms each grow two fields] → They already share the account step's
  shape; the fields go in beside the email in each.

## Migration Plan

One additive migration: two nullable text columns on `user`. Every existing account gets
null for both, which is what "not given" means.
