## Why

A member who forgets their password has no way back in: the only way to change it is from
the profile, which needs the current one, and the system sends no email at all.

## What Changes

- The sign-in form offers «Забыли пароль?» under the password field, at its right edge.
- A member asks for a reset link by giving their email; the answer is the same whether or
  not an account uses that address.
- The system sends the link by email over SMTP — Google's by default — so the backend
  gains a mail transport and its configuration.
- The link opens a form for a new password and its confirmation; the two must match. A
  link works once, for one hour, and a newer one replaces it.
- Setting a new password signs the member out everywhere else and signs them in here.

## Capabilities

### New Capabilities
- `password-recovery`: asking for a reset link by email and setting a new password with it.

### Modified Capabilities

## Impact

- API: `POST /api/auth/password-reset`, `GET` and `POST /api/auth/password-reset/{token}`;
  the identity module's use cases, ports and adapters; a `password_reset` table; an
  `unavailable` error category answered with 503.
- Configuration: `APP_URL`, `SMTP_USER`, `SMTP_PASSWORD`, optional `SMTP_HOST`,
  `SMTP_PORT` and `MAIL_FROM`, in `.env.example`, `docker-compose.yml` and `render.yaml`.
- Dependency: `nodemailer` in `apps/api`.
- Web: the sign-in page's link, `/password-reset` and `/password-reset/:token` pages, the
  auth API client and `AuthProvider`.
