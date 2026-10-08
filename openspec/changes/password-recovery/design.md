## Context

The identity module signs members in with an access JWT and a refresh token whose SHA-256
hash is stored in `refresh_token`. Its use cases depend on ports (`UserRepository`,
`TokenPort`, `RefreshSessionRepository`) wired in `composition/create-container.ts`, and
the auth routes are public and rate limited. Nothing in the system sends email; invitation
links are handed on by people. The service runs on Render's `starter` plan, which allows
outbound SMTP on ports 465 and 587.

## Goals / Non-Goals

**Goals:**
- Recovery by email link, with no way to learn which emails are registered.
- A mail transport the rest of the backend can reuse.

**Non-Goals:**
- Resetting another member's password as an admin.
- Email verification, templates beyond this one message, or a mail queue.

## Decisions

- **One `password_reset` row per user, holding a token hash.** `user_id` is unique, so
  asking again replaces the row and the older link stops working; a successful reset
  deletes it, so a link works once. The token is 32 random bytes in hex, hashed with
  SHA-256 like refresh tokens; the hash is unique and indexed for lookup.
- **The answer never depends on the account.** Asking always answers 202. The email is
  handed to the mailer without being awaited, so the response does not wait on SMTP only
  when an account exists; the adapter logs a failed send. Every unusable token — unknown,
  expired or replaced — answers 404 with one message.
- **Resetting ends every session.** In one transaction the password hash is replaced, the
  reset row and all of the user's refresh tokens are deleted, and a new token pair is
  issued and set in cookies, so the page can enter the app directly.
- **SMTP through `nodemailer`, defaulting to Gmail.** `SMTP_USER` and `SMTP_PASSWORD` turn
  mail on; `SMTP_HOST` defaults to `smtp.gmail.com`, `SMTP_PORT` to 465 with implicit TLS
  (STARTTLS on any other port), `MAIL_FROM` to `AdPulse <SMTP_USER>`. Gmail needs an app
  password, not the account's own. `APP_URL` is the base of the link, never the request's
  `Host`, so a forged header cannot redirect a link. Alternatives: an HTTP provider such as
  Resend, which ties the code to one vendor; SMTP keeps Gmail, Workspace or any provider a
  configuration change away.
- **Mail is optional outside production.** Without SMTP settings, development and tests use
  a transport that writes the message to the log; `APP_URL` defaults to
  `http://localhost:5173`. In production, without SMTP or `APP_URL` the identity module is
  told recovery is unavailable and answers 503 through a new `unavailable` error category,
  rather than failing to start or swallowing requests.
- **The message is composed in identity's infrastructure, sent through a shared
  transport.** `shared/infrastructure/mail.ts` holds the SMTP and log transports;
  `ResetLinkMailer` builds the Russian message and link. The use case sees only a
  `ResetLinkDelivery` port.
- **The web reuses registration's rules.** The reset form validates like the employee
  registration form — at least 8 characters, confirmation must match, said against the
  confirmation field. `AuthProvider` gains `resetPassword`, which stores the returned
  tokens and loads the session as `login` does.

## Risks / Trade-offs

- [Gmail limits sending, around 500 messages a day for a personal account] → far above what
  recovery needs; a Workspace account or another provider is a configuration change.
- [An app password leaks with the environment] → it is stored as a Render secret with
  `sync: false`, and revoking it in the Google account stops it at once.
- [Timing still differs by one database write for a registered email] → small and noisy
  next to the network; the SMTP exchange, the large difference, is not awaited.

## Migration Plan

A new `password_reset` table with a foreign key to `app_user` that cascades on delete; no
existing data changes. Deploy runs `prisma migrate deploy` before the new instance starts.
Before or after the deploy, set `APP_URL`, `SMTP_USER` and `SMTP_PASSWORD` on Render; until
then the request answers 503 and nothing else is affected. Rollback drops the table.
Locally, `nodemailer` is a new dependency, so the api container needs
`docker compose up -d --build --renew-anon-volumes api`.
