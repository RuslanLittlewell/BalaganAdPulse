## Context

The audit is summarised in proposal.md. Sign-in runs through `identity-use-cases.login`, which looks a user up by login, then by email, and verifies the password with scrypt against a dummy hash when no user matches. Authentication reads the access token from the `Authorization` header or the `adpulse_access` cookie. `protectiveHeaders` sets one header set for every response. The WebSocket upgrade reads the same cookie and builds a `ws` server with default options. The docs router is mounted when `config.documentation` is true.

## Goals / Non-Goals

**Goals:**
- Each finding is closed where it starts, with a test that fails without the fix.
- No answer tells whether a login exists.

**Non-Goals:**
- Moving Tiptap from 2 to 3, React Router from 6 to 7 and Prisma from 6 to 7. Their advisories are fixed only in the next major release, each needs its own change. React Router's open redirect needs a path the app takes from an attacker; the app navigates only to paths it built itself.
- A platform-admin screen to lift a lock. A reset or a newly issued password lifts it.
- Rejecting SVG creatives and failing on default storage keys; both stay on the audit's list.

## Decisions

**The lock lives in its own table, keyed by account or by typed login.** `sign_in_lock` holds a key, the failures in the current round, the round (0, 1 or 2), `locked_until` and `reset_required`. The key is `user:<id>` when the typed login or email resolves to a user, otherwise `login:<lowercased text>`. Keying by account makes the login and the email share one count; keying unknown text the same way keeps the answers identical. Alternative: a column on `app_user`. Rejected because unknown logins must lock too, and they have no user row.

**The order of checks inside login.** Resolve the user, read the lock, refuse while locked or while a reset is required, then verify the password. A locked request still runs no scrypt, which is cheaper and reveals nothing new, because the lock answer is the same for known and unknown logins. A success deletes the lock row. A failure increments in one statement (`INSERT … ON CONFLICT DO UPDATE`), so parallel guesses cannot slip past the third failure. The third failure of round 0 sets `locked_until` 15 minutes ahead and moves to round 1; of round 1 sets `locked_until` 30 minutes ahead and `reset_required`. The answer that sets a lock is already the lock answer.

**Unlocking.** `resetPassword` and the client-accounts password issue delete the account's lock row in their transactions. Rows keyed by unknown text are deleted when they are older than 30 days, by the same statement that writes a failure.

**Cross-origin writes are refused in the authentication middleware.** It already knows whether the token came from the cookie. For unsafe methods with a cookie token it compares `Origin` (or, without one, `Sec-Fetch-Site`) with the app's origin from `config.appUrl` and with `req.protocol://req.host`. The open endpoints (intake, webhooks, trial signup, password reset) do not use the session cookie, so they are unaffected. Alternative: CSRF tokens. Rejected as a second mechanism for a problem the browser headers already answer.

**The WebSocket checks the same origin and caps frames.** `WebSocketServer({ noServer: true, maxPayload: 16 * 1024 })`, and the upgrade is refused with 403 when `Origin` is present and foreign. A missing `Origin` is allowed, because browsers always send it and server-side clients cannot carry the victim's cookie.

**The content security policy.** `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self' <app ws origin>; frame-src https://www.facebook.com https://*.facebook.com; worker-src 'self' blob:; form-action 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`. Inline styles stay allowed because React and Radix write `style` attributes. The docs page overrides the header with its inline script's hash. `app.disable("x-powered-by")`.

**The docs flag.** `documentation = API_DOCS === "on" || (!production && API_DOCS !== "off")`.

**Dependencies.** `npm audit fix` fails on this workspace with an internal npm error, so `npm update` moves `body-parser`, `multer`, `qs`, `proxy-addr` and `nodemailer` to patched releases inside their ranges, and `react-router` to 6.30.6, the newest 6.x. `shadcn` moves to the web app's `devDependencies`, which also drops `undici`, `hono` and the MCP SDK from the runtime tree.

## Risks / Trade-offs

- Anyone who knows a member's email can lock their password sign-in → accepted as the price of the policy; the reset link always works and the lock message points to it.
- A missed host in the content security policy breaks a screen → the policy is checked against every external host the web app references, and the built bundle is checked for `eval` and `new Function`.
- A proxy that strips `Origin` → requests without `Origin` and without `Sec-Fetch-Site` pass, so only browser cross-site requests are refused.

## Migration Plan

Apply the `sign_in_lock` migration, deploy the API and the web app together. Production loses `/api/docs` unless `API_DOCS=on` is set. Rollback is the previous release; the table can stay.
