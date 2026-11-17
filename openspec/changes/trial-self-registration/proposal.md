## Why

A new organization can only appear when the platform administrator adds it by hand. The landing's «Попробовать бесплатно» button leads to a contact form, so every trial waits for a person to read the lead, create the organization and send the first administrator a link. A visitor who wants to try the product should be able to do it alone, in a few minutes.

## What Changes

- Add a public page `/trial` in the web app. It asks for an organization name, the visitor's name, an email, a password and its confirmation.
- Add `POST /api/trial-signups`. It stores the request as pending, mails a confirmation link and answers 202 whether or not the email is already registered.
- Add `GET /api/trial-signups/:token` to check a link and `POST /api/trial-signups/:token/confirm` to redeem it. Redeeming creates a `TRIAL` organization and its first `ADMIN` in one transaction and signs the visitor in.
- Add a confirmation page `/trial/confirm/:token` that redeems the link and takes the visitor into the app.
- Point the landing's «Попробовать бесплатно» buttons to `/trial` instead of the contact form.
- Rate-limit signup requests like sign-in and reset requests.

## Capabilities

### New Capabilities
- `trial-self-registration`: a visitor registers a trial organization alone, confirming their email first.

### Modified Capabilities
- `registration-invitations`: the rule «An invitation link is the only way in» gains one exception, the trial signup, which creates a new organization rather than joining one.
- `public-landing`: the trial call to action leads to `/trial`.

## Impact

- `apps/api`: a new `trial-signups` module, a Prisma table for pending signups, a confirmation email next to the password reset one, a route in the composition root.
- `apps/web`: pages `trial` and `trial-confirm`, copy in `ru.ts` and `en.ts`.
- `apps/landing`: the trial button and the footer topic link.
- No change to the tariff catalogue: a trial keeps its current limits and length from `trialEndsAtFrom`.
