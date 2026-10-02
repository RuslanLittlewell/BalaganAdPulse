## Context

`GET /api/members/:id/avatar` checks the `member/read` permission (admins and client
admins), while the roster is shown to everyone under `discloses` in the presence domain.
The web draws every member picture from that endpoint.

## Goals / Non-Goals

**Goals:**
- One rule for who sees whom: the presence disclosure rule decides pictures too.

**Non-Goals:**
- Opening member listings or member details to more roles.

## Decisions

- **Reuse `discloses` from the presence domain** instead of restating the rule in the
  members module. Its person parameter is narrowed to the fields it reads (organization,
  role, client ids), so the members use case can pass a membership without inventing a
  name or picture.
- **Client ids are fetched only when both sides are customers**, the only case where the
  rule reads them; staff requests cost no extra query.
- **Refusal answers 404**, like the organization check, so the endpoint does not confirm a
  member exists.

## Risks / Trade-offs

- [`CLIENT_ADMIN` loses pictures of other clients' people it could fetch before] → they
  were never shown to it anywhere; the rule now matches the roster.

## Migration Plan

No schema change.
