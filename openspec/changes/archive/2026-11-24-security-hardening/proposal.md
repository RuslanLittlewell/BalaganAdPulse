## Why

A security audit of the API and the web app found no broken access control, but it found unauthenticated denial of service in the installed `body-parser`, `multer` and `qs`, a content security policy that sets no script rules, sign-in limited by address only, cross-site requests stopped by `SameSite=Lax` alone, a WebSocket that accepts any origin and 100 MB frames, and the API documentation open in production. Self-service trial signup now lets anyone on the internet hold an admin account, which makes each of these easier to reach.

## What Changes

- Upgrade `body-parser`, `multer`, `qs`, `proxy-addr` and `nodemailer` to patched releases, take `react-router` to the last 6.x release, and move `shadcn`, a code generator, out of the web app's runtime dependencies.
- Lock password sign-in after failed attempts: three failures lock it for 15 minutes, three more lock it for 30 minutes, and after that only a password reset opens it again. The lock follows the account, whichever of its login or email is typed, and an unknown login behaves exactly like a known one.
- Serve the API documentation only outside production unless an operator turns it on with `API_DOCS=on`. **BREAKING** for anyone reading `/api/docs` on production.
- Send a content security policy that allows scripts, styles, connections and frames only from the app itself and from the hosts it needs, and stop announcing `X-Powered-By: Express`.
- Refuse state-changing requests authenticated by cookie when the browser says they come from another origin, and refuse WebSocket connections from another origin.
- Cap a WebSocket message at 16 KB.

## Capabilities

### New Capabilities
- `sign-in-protection`: the failed-attempt lock on password sign-in, the cross-origin refusal for cookie-authenticated writes and for WebSocket connections.

### Modified Capabilities
- `api-documentation`: the documentation is off in production by default.
- `input-safety`: the protective headers include a full content security policy and drop `X-Powered-By`.
- `password-recovery`: setting a new password through a reset link lifts the sign-in lock.

## Impact

- `apps/api`: a `sign_in_lock` table and migration, the identity login use case, the authentication middleware, the WebSocket transport, `protective-headers.ts`, the docs flag in `config.ts`, the client-accounts password issue.
- `apps/web`: the sign-in form shows the lock with a link to recovery; `package.json` moves `shadcn` to development dependencies.
- Root `package-lock.json`: patched dependency versions.
- Related fixes land in the open changes they belong to: `bitrix24-sync` (address pinning, port 443, refusal limit, website check) and `trial-self-registration` (the confirmation email no longer repeats typed names, and is limited per address).
