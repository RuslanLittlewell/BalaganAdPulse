## Context

`GET /api/regustration/:code` answers `{ registrationType }` for a pending code and one
uniform error otherwise. Redemption already rejects an address other than the bound one
(`isRedeemable`). Invitations created by the platform administrator are always bound;
those created inside an organization are bound only when the API caller sets `email`.

## Goals / Non-Goals

**Goals:** the form never asks for an email the invitation already fixes.

**Non-Goals:** changing redemption, letting registration omit the email, emailing links.

## Decisions

- **The lookup returns `email`** rather than registration accepting a missing email and
  filling it in server-side. The form must show which address the account will sign in
  with, and the register endpoint keeps one contract for bound and unbound invitations;
  the server still checks the address against the invitation.
- **One rule for all three forms.** A bound address replaces the email field with a
  read-only line naming it; an unbound invitation keeps the field. The client form also
  submits it as the client's contact email, as it does with a typed address today.

## Risks / Trade-offs

- Whoever holds a bound link now learns the address and can register with it. Before, a
  leaked bound link was useless without also knowing the address. The link is handed to
  that person and is single use, so the second factor bought little; a link sent to the
  wrong person can be revoked as before.
