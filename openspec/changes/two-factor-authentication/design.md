## Context

Sign-in lives in `identity`: `login` checks the sign-in lock, verifies the password and issues a token pair; `resetPassword` replaces the password, ends sessions and issues a pair. Both answers set the session cookies in `identity-http`. Members are resolved into an actor after authentication; the platform administrator has no membership and therefore no actor. The client IP comes from `req.ip` with `trust proxy` set to one hop. See proposal.md for the motivation.

## Goals / Non-Goals

**Goals:**
- No session cookie is set before the second factor passes on an unconfirmed address.
- The platform administrator, who has no actor, can use two-factor sign-in too.
- Guessing codes is as limited as guessing passwords.

**Non-Goals:**
- SMS, email codes, passkeys or WebAuthn.
- Asking again when a running session changes address.
- Grouping addresses into networks. An IPv6 client whose address changes is asked again; it can forget old addresses.

## Decisions

**A `two-factor` module owns the data and the code step.** Tables: `two_factor` (user, sealed secret, sealed pending secret, enabled at, last used time step), `two_factor_backup_code` (user, hash, used at), `trusted_address` (user, address, confirmed at, last used at, unique per user and address), `two_factor_challenge` (token hash, user, expires at). `organization.require_two_factor` holds the requirement. All rows go with the user or the organization.

**Identity asks a port, and the module completes through identity.** `identity` gets a `SecondFactorGate` port with `needed(userId, address)` and `open(userId, address)`. When `needed` is true after the right password, or after a reset, it returns `{ kind: "challenge", challenge, expiresAt }` and sets no cookie. `identity` also gains `completeSecondFactor(userId, verify)`: it reserves a slot in the sign-in lock for the account, runs `verify`, locks on the third failure exactly as for passwords, clears the lock and issues the pair on success. The module's `POST /api/auth/two-factor` resolves the challenge, calls it with its own code check, then trusts the address. The composition root wires the two with late binding, because each needs the other. Alternative: verify the code inside `identity`. Rejected because identity would then own secrets, backup codes and addresses it has no other use for.

**TOTP on `node:crypto`, in Google Authenticator's format.** RFC 6238 with HMAC-SHA-1, 30-second steps and six digits, which are Google Authenticator's defaults and the only values it honours. The `otpauth://` URI encodes spaces as `%20`, because the app shows a `+` literally. The secret is 20 random bytes in base32, and a code is accepted one step either side of the current one. A matched step is stored as `last_step` with `UPDATE … WHERE last_step IS NULL OR last_step < $step`, so a code cannot be used twice and two parallel requests cannot both spend it. The adapter lives in infrastructure behind a `Totp` port. Alternative: `otplib`. Rejected for a dependency that adds nothing the 40 lines do not.

**QR codes are drawn on the server.** The `qrcode` package renders the `otpauth://` URI as SVG; the web app shows it as an image and the base32 key as text. Drawing on the server keeps the dependency out of the bundle.

**Secrets and codes.** The secret is sealed with AES-GCM under `INTEGRATION_ENCRYPTION_KEY`, bound to `totp:<userId>`. Backup codes are ten codes of ten characters from an unambiguous alphabet, shown as `xxxxx-xxxxx`, stored as SHA-256 of the normalized code and spent with `UPDATE … WHERE used_at IS NULL`. Challenges are 32 random bytes, stored as SHA-256, valid for five minutes, deleted when spent.

**The code field is React Bits' Code Slots.** `shared/ui/CodeSlots` holds the component from the React Bits registry (`CodeSlots-TS-TW`), with the Hugeicons check mark replaced by Lucide's, its lint pragmas removed, and its two screen-reader phrases turned into props; `OneTimeCode` wraps it with the theme's colours and the dictionary's phrases. It sends on `onComplete`, so the sixth digit submits. Backup codes, which contain letters, keep a plain text field.

**Routers.** `/api/two-factor` (status, setup, confirm, disable, backup codes, addresses) needs only a principal and is mounted before actor resolution, so the platform administrator reaches it. `/api/organization/two-factor` (read and set the requirement, reset a member) needs an actor. `/api/platform/two-factor/reset` is mounted before the platform router and checks the platform administrator itself. `/api/auth/two-factor` is open and rate-limited like sign-in.

**The requirement gate.** A middleware after actor resolution looks up the organization's requirement and the user's enrolment in one query, and answers 403 `TWO_FACTOR_SETUP_REQUIRED` for an employee without it. The status endpoint tells the web app to show the setup screen. Clients and partners are never gated.

**Resets.** An admin reset needs `update` on `member`, a member of the same organization and not the admin themself; it deletes the module's rows for the user, revokes refresh tokens through identity and writes an audit event. The platform reset finds the account by email.

## Risks / Trade-offs

- A lost phone and lost backup codes on the only admin → the platform administrator resets by email.
- Members behind changing addresses are asked often → they can forget stale addresses; grouping by network is a later change.
- `INTEGRATION_ENCRYPTION_KEY` missing in production → setup answers 503 and nothing is half-enabled.
- Clock drift on the phone → one step either side is accepted.

## Migration Plan

One migration adds the tables and the organization column with `false`. Nobody has a second factor until they turn it on, so deploying changes no sign-in. Rollback is the previous release; the tables can stay.
