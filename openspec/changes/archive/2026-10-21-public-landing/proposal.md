## Why

Google refused the OAuth branding of BalaganBI because its home page, app.balagan.pro, is a login
page that does not explain what the app does. Publishing the OAuth app, so that clients can
connect their own Google Ads accounts, needs a public home page and a privacy policy that say what
BalaganBI does with Google user data, on a domain the agency owns.

## What Changes

- A public landing site for BalaganBI, served at `bi.balagan.pro`: a home page that explains the
  app, how a Google Ads account is connected and what data is read and why, and a privacy policy
  that covers Google user data.
- It wears the web app's palette, light and dark, and the same animated waves behind it.
- It is built with Astro and Tailwind in `apps/landing` and ships inside the same production
  image as the API and the web app: the server answers the landing host with the landing and
  every other host as before.

## Capabilities

### New Capabilities

- `public-landing`: the public pages of BalaganBI and the host they are served on.

### Modified Capabilities

None.

## Impact

- New workspace `apps/landing` (Astro, Tailwind, ogl).
- API: `composition/app.ts` serves the built landing for the landing host; `LANDING_HOST`
  configures it.
- Build and deploy: the production Dockerfile builds and ships the landing; CI builds and tests it;
  `deploy/nginx.conf` gains the `bi.balagan.pro` server.
