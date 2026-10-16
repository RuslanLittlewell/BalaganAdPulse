## 1. Backend

- [x] 1.1 Add the `password_reset` model and its migration.
- [x] 1.2 Add `nodemailer`, the mail settings to `Config`, and the SMTP and log transports in `shared/infrastructure/mail.ts`; add the `unavailable` error category answered with 503.
- [x] 1.3 Add the identity ports and use cases: ask for a link, check a token, reset the password ending every session.
- [x] 1.4 Add the Prisma reset repository, the token methods, `ResetLinkMailer`, and wire them in the container.
- [x] 1.5 Add the three routes with their schemas, rate limits and OpenAPI entries.
- [x] 1.6 Cover the use cases, the mailer's message, the config and the routes end to end; run `npm test`.

## 2. Web

- [x] 2.1 Add the auth API calls and `AuthProvider.resetPassword`, the copy, and the two public routes.
- [x] 2.2 Add «Забыли пароль?» under the sign-in password field, carrying the typed email.
- [x] 2.3 Add the request page and the reset page with its invalid-link and unavailable states.
- [x] 2.4 Cover the sign-in link, both pages and their states; run `npm run test:web`.

## 3. Configuration

- [x] 3.1 Document `APP_URL` and the SMTP settings in `.env.example`, pass them in `docker-compose.yml`, declare them in `render.yaml`.
- [x] 3.2 `openspec validate password-recovery --strict`.
