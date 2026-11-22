## Why

A password is the only thing between an attacker and an account, and since trial signup anyone can hold an admin account in some organization. A second factor from an authenticator app stops a stolen or guessed password from being enough, and asking for it only on addresses the account has not confirmed keeps it out of the way at a desk the member already uses.

## What Changes

- A member can turn on two-factor sign-in in the profile settings: scan a QR code into Google Authenticator, confirm with a code, and save ten one-time backup codes.
- Signing in from a network address the account has not confirmed asks for a code from the app or a backup code. A confirmed address is trusted until the member forgets it in the profile settings.
- Setting a new password through a reset link from an unconfirmed address also asks for the code before signing in.
- Wrong codes count toward the existing sign-in lock.
- Turning two-factor sign-in off and issuing new backup codes need a current code.
- An organization admin can require two-factor sign-in for employees. An employee without it can only set it up after signing in.
- An organization admin can reset another member's second factor, and the platform administrator can reset anyone's by email.

## Capabilities

### New Capabilities
- `two-factor-authentication`: enrolment, the code step at sign-in and after a password reset on unconfirmed addresses, trusted addresses, backup codes, the organization requirement and resets.

### Modified Capabilities

## Impact

- `apps/api`: new columns on `app_user` and `organization`, tables for backup codes, trusted addresses and pending challenges, a TOTP implementation on `node:crypto`, the `qrcode` package to draw the QR code, changes to sign-in and password reset answers, new endpoints under `/api/auth/two-factor`, `/api/user/two-factor`, `/api/members/:id/two-factor`, `/api/platform/two-factor`, and a gate after actor resolution.
- `apps/web`: the code step on the sign-in and reset pages, a section in the profile settings, a setup screen when an organization requires it, the requirement switch and the reset action in the employee directory, and the reset form in the platform area.
- Depends on `security-hardening` for the sign-in lock that wrong codes feed.
