## Why

A client reaches their cabinet today only by following an invitation link and filling in a
registration form themselves. Agencies want to hand a client ready-made credentials instead:
a login and a password they create on the client's card, can look up again when the client
forgets them, and can replace when needed.

## What Changes

- An agency admin can create cabinet access for a client from the client's card in the
  contact book. The backend generates a login from the client's name and a random password,
  and creates an account that is the client's principal (`CLIENT_ADMIN`) reaching that client.
- The admin can read the login and password again at any time, and can issue a new password,
  which ends the account's sessions and stops the old password from working.
- The password the agency issued is kept encrypted so it can be shown again; the hash still
  decides sign-in. When the account's holder sets a password of their own, the kept copy is
  dropped and the card says the client changed it.
- Only admins see or use any of this. Managers, guests and customers are refused.
- Sign-in accepts either an email or a login in one field. **BREAKING** for API callers:
  `POST /api/auth/login` takes `{ login, password }` instead of `{ email, password }`.
- An account may have no email. Session, profile, member and audit payloads carry
  `email: null` for such an account, and the session and profile also carry its `login`.
- Deleting a client removes the account created for it.
- Creating access and issuing a new password are recorded in the activity log.

## Capabilities

### New Capabilities
- `client-credentials`: agency-issued sign-in credentials for a client's cabinet — generating,
  reading again, replacing, the client changing them, and signing in with a login.

### Modified Capabilities

## Impact

- Database: `app_user.email` becomes nullable; `app_user` gains `login` (unique) and
  `issued_password`; new table `client_account`; `audit_event.actor_email` becomes nullable.
- API: new endpoints under `/api/clients/:clientId/account`; login body changes; nullable
  `email` in session, profile, member and audit responses.
- Shared permission matrix: new resource `client-account`, admins only.
- Web: the contact book's client card, the sign-in form, the user menu.
- Configuration: reuses `INTEGRATION_ENCRYPTION_KEY`; no new variable.
