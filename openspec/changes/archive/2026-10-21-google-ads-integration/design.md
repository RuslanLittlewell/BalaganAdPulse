## Context

A Meta connection stores an account id and a long-lived access token pasted by the member. The
import pipeline (queue, worker, lease, daily schedule, snapshot, currency rule) does not depend
on the provider except for the client that reads the account and the error type, which is named
after Meta.

Google Ads cannot be connected with a pasted token. Access comes from OAuth 2.0: a member signs
in with Google, the server keeps a refresh token and exchanges it for access tokens that last
about an hour. Every request also carries the application's developer token.

## Goals / Non-Goals

**Goals:**

- Per-project Google sign-in, so each project's credential is its own, encrypted for that
  project like Meta's token.
- Reuse the import pipeline unchanged: a Google client produces the same snapshot.

**Non-Goals:**

- An organization-wide Google authorization.
- Leads from lead form extensions, creative files, and conversion actions chosen per account.

## Decisions

- **Connect flow.** The member starts Google sign-in from the project; the server sends them to
  Google with a state bound to that member, project and a single use, receives the callback,
  stores the refresh token encrypted with the project, and lists the Google Ads accounts the
  sign-in can reach. The member picks one; the connection is saved and an initial import queued.
  Choosing the account and saving it is a separate step from the callback, so the browser never
  holds a credential.
- **Reached through a manager account.** An account reached through a manager account stores
  that manager account's id beside its own; both are sent with each request.
- **Provider-neutral core.** `provider` takes `GOOGLE`, the value its campaigns already use as their channel; the provider error type and the
  OpenAPI enum lose the word Meta. The Meta routes and behaviour are unchanged.
- **Figures.** Cost arrives in millionths of the currency and is converted to a four-decimal
  `Decimal`. Conversions and revenue are the account's own `conversions` and
  `conversions_value`. Reach is not available at every level and is stored as zero where Google
  does not report it, which the totals already tolerate.
- **Revoked access.** A rejected or revoked refresh token puts the connection in the same
  authorization-required state as an expired Meta token, keeping imported data and asking the
  member to sign in again.
- **Developer token.** An application-wide secret in configuration. Without it, or without the
  OAuth client, connecting Google answers with a configuration error and Meta is unaffected.

## Risks / Trade-offs

- The developer token needs Google's approval; until it is granted for standard access, only test
  accounts can be connected. Mitigation: build and test against recorded responses meanwhile.
- A refresh token issued while the application is in testing expires after seven days. Mitigation:
  the revoked-access path covers it; production use needs the OAuth consent screen verified.
