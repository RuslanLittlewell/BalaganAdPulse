## Context

The Google Ads client sends the developer token from configuration as a header, and the
configuration is null without it. Since the retirement the API decides the access level from the
Cloud project of the OAuth client used to sign in.

## Decisions

- Remove the variable rather than make it optional: an optional token would still be sent and
  would break once Google starts rejecting it.
- Keep recognising Google's `DEVELOPER_TOKEN_*` error codes as a lack of access. They cost
  nothing and still explain an answer from an older API version.
- An existing `GOOGLE_ADS_DEVELOPER_TOKEN` in a deployment's environment is simply ignored, so
  removing it from the server's `.env` is tidy-up, not a deployment step.
