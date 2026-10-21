## Why

Projects are connected to Meta only, while many clients advertise in Google Ads. The
provider window already lists Google as "not yet available". A media buyer wants a project's
Google Ads campaigns and daily figures beside its Meta ones, kept current without manual entry.

## What Changes

- A project can be connected to one or more Google Ads accounts, each as its own connection,
  by signing in with Google on that project. Every connection holds its own credential; nothing
  is shared between projects or organization-wide.
- The server imports the account's campaigns, ad groups, ads and daily figures into the project,
  on the same schedule, with the same manual refresh, status and disconnect behaviour as Meta.
- Each Google connection is a tab beside the Meta ones, named `Google · account`.
- The provider window makes **Google** selectable.
- Out of scope for this change: lead import from lead form extensions, and copying creative
  files. An ad's text may be shown; images and videos are not read.

## Capabilities

### New Capabilities

- `google-ads-project-integration`: connecting a Google Ads account to a project through
  Google sign-in, and importing its campaigns and figures.

### Modified Capabilities

- `meta-project-integration`: the provider window offers Google as a selectable provider.

## Impact

- Prisma: the integration holds a refresh credential and the Google-specific fields (the
  manager account an account is reached through); `provider` gains a new value.
- API: Google Ads client, OAuth connect and callback routes, provider-neutral import and error
  types, OpenAPI.
- Web: a Google connection panel and account choice, the provider window, the tabs, copy.
- Configuration: Google OAuth client id and secret, the Google Ads developer token, and the
  redirect address; none of them is stored in the repository.
