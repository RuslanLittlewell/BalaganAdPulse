## Context

The import pipeline (queue, worker, lease, daily schedule, snapshot, currency rule, creative
copying) is provider-neutral since Google Ads: a provider supplies the account, a snapshot and an
ad's creatives. Google's connection is an OAuth flow: a pending sign-in record bound to member,
project and a single use; a callback that stores the credential in it; an account choice; then
the connection. Yandex Direct fits the same shape, with differences that drive the decisions below.

Direct API v5 is JSON over HTTPS at `api.direct.yandex.com/json/v5/` (sandbox:
`api-sandbox.direct.yandex.com`). Objects come from per-service `get` methods; figures come from
the Reports service as TSV, built online or queued offline. Access needs an OAuth application at
oauth.yandex.ru with the right to use the Direct API, and an access request in Direct approved for
full access; test access works with the sandbox only.

## Goals / Non-Goals

**Goals:**

- Per-project Yandex sign-in reusing Google's flow and its pending sign-in record.
- A Direct client that produces the same snapshot and creatives as the Google one, so the worker,
  persistence, result typing and preview need no Yandex-specific branches beyond result typing.

**Non-Goals:**

- Metrica goals as separate result types, and goal names. The sign-in asks for Metrica read access
  as optional now, so that change will not need every connection to sign in again.
- Direct leads, the search query report, editing campaigns.

## Decisions

- **Sign-in.** Authorization code flow at `oauth.yandex.ru/authorize` with `state` set to the
  pending record's id, `force_confirm=yes` so the member picks which Yandex ID to use, scope
  `direct:api` and optional scope `metrika:read`. The callback, at
  `/api/integrations/yandex/callback` unless configured otherwise, exchanges the code at
  `oauth.yandex.ru/token` with the client id and secret in a Basic header. Then come the account
  choice and the connection, as for Google, with the same lifetimes (ten minutes to sign in,
  thirty to choose).
- **One pending sign-in table.** `google_authorization` becomes `oauth_sign_in` with a `provider`
  column, and its credential column a provider-neutral name. A sign-in is read only for its
  provider, so a Yandex state cannot complete a Google sign-in. Pending rows live minutes, so the
  migration renames in place, and existing rows get `GOOGLE`. A second, copied table was rejected
  because the record's rules (single use, owner, expiry) would be duplicated.
- **Credential.** Yandex returns an access token and a refresh token with the same long lifetime
  and recommends renewing every three months. The connection's encrypted token holds both tokens,
  the expiry and when they were obtained, as JSON encrypted with the project like Meta's token.
  Before an import, a credential obtained more than 90 days ago is renewed and stored at once,
  outside the import's transaction, because the old refresh token may stop working. The worker
  passes only the decrypted token to a source today, so a source gains an optional renewal step
  that the worker calls before the snapshot, storing what it returns through the job while the
  job holds its lease. `invalid_grant` on renewal and Direct's authorization error put the
  connection in the authorization-required state already used by Meta and Google.
- **Accounts.** `Clients.get` tells the signed-in login's type. For `CLIENT` or `SUBCLIENT` the
  one choice is the login itself. For `AGENCY`, `AgencyClients.get` with `Archived: NO`, paged,
  gives the choices, and every later request for the chosen client carries `Client-Login`. The
  account id is the advertiser's login, and the agency login is stored in `loginCustomerId`, which
  already means "reached through". Logins are compared lowercased with dots read as hyphens, as
  Yandex treats them as one; the account id is stored in that form.
- **Currency and day.** The currency comes from `Clients.get` or `AgencyClients.get`; `YND_FIXED`
  (conventional units) is refused. Direct has no account time zone and counts statistics by Moscow
  time, so a Yandex connection's time zone is `Europe/Moscow`.
- **Figures.** Three reports, `CAMPAIGN_PERFORMANCE_REPORT`, `ADGROUP_PERFORMANCE_REPORT` and
  `AD_PERFORMANCE_REPORT`, with `Date`, the level's id and `Impressions, Clicks, Cost, Conversions,
  Revenue`, `DateRangeType: CUSTOM_DATE` over the window, `IncludeVAT: NO`, money in micros, and
  `processingMode: auto`. Each level is read on its own, as Google does, instead of summing ads,
  so a level's figures are what Direct shows for it. Report rows are mapped by the column-header
  row; `--` is zero; cost and revenue go through the micros conversion Google already uses.
  Conversions are rounded to a whole number and are also the results.
- **Waiting for reports.** A report name is a hash of the account, level and window, so a repeated
  request asks for the same report, as offline mode requires. On 201 or 202 the client waits
  `retryIn` seconds, capped, within a total budget of about two minutes: the worker runs one
  import at a time, and a longer wait would hold up every other connection. Past the budget, the
  import fails as a retryable provider error. Direct keeps building the report, so the next
  attempt asks for the same report and usually receives it at once.
- **Hierarchy.** `Campaigns.get` reads every campaign that is not archived, plus the archived ones
  that appear in the reports. `AdGroups.get` and `Ads.get` read by campaign, ten campaigns per
  request as the API allows, following `LimitedBy` for further pages. Status: `ON` is active;
  `OFF` and `SUSPENDED` are paused; `ENDED`, `ARCHIVED` and `CONVERTED` are ended; moderation
  `REJECTED` is rejected. An ad group takes its campaign's state unless it is rejected. A Direct ad
  has no name, so an ad is named by its headline, or by `Ad <id>` as Google ads are. The campaign
  `Type` is kept as its objective.
- **Errors.** Direct's JSON error code is classified as follows:
  - authorization (53) is `TOKEN`;
  - missing rights, an unapproved application, or a login not in Direct (54, 58, 513) are
    `ACCESS`;
  - out of points (152) is `PROVIDER`, with a retry the next morning;
  - temporary unavailability, server errors, and a full offline report queue are `PROVIDER`,
    retried;
  - anything else is `INVALID_DATA`.
- **Result type.** The result typing treats `YANDEX` campaigns as it treats a Google campaign
  without categories: type conversions, results from the figures' results, and the whole spend.
- **Creatives.** `Ads.get` by id with the type-specific field names reads the ad. Images come from
  `AdImages.get` by hash (`OriginalUrl`). Video extensions give `ThumbnailUrl` as the poster and
  `PreviewUrl` as the watch link. Builder creatives give their thumbnail. The files are copied
  through the existing creative storage, so a stored creative outlives the connection.
- **Configuration.** `YANDEX_OAUTH_CLIENT_ID`, `YANDEX_OAUTH_CLIENT_SECRET`,
  `YANDEX_OAUTH_REDIRECT_URI` (defaults from `APP_URL`) and `YANDEX_DIRECT_SANDBOX`, which points
  Direct requests at the sandbox while only test access is approved. Without the client id or
  secret, connecting Yandex answers with a configuration error.
- **Web.** Yandex becomes selectable in the provider window and starts sign-in like Google. The
  callback returns to the project with `?yandex=<authorization>`, which opens the account choice.
  The account choice and the connection panel are shared with Google and parametrised by provider,
  rather than copied.

## Risks / Trade-offs

- [Full API access is granted by Yandex after review, and test access reaches only the sandbox]
  → Apply for full access as soon as the OAuth application is registered. Build and test against
  recorded responses meanwhile, and try the flow on the sandbox through `YANDEX_DIRECT_SANDBOX`.
- [Days counted in Moscow time is an assumption from the Direct interface] → Compare one day's
  figures with the Direct interface on the first real account. If it is wrong, the time zone is
  one value to change, and the next import rewrites the window.
- [Several projects reached through one agency login share its offline report queue (five
  reports) and its points] → The worker runs one import at a time and an import asks for its
  reports one after another, so one process holds at most one report in the queue. A full queue
  is a retryable error.
- [Video and builder preview addresses may need a Yandex session to open] → Their thumbnails are
  copied either way. If the link turns out not to open for others, it is dropped and the
  thumbnail stays.
- [A renewed credential lost to a crash between renewal and saving] → The connection asks for
  sign-in again, and no data is lost.

## Migration Plan

One Prisma migration renames the pending sign-in table, adds `provider` and renames the credential
column; there is no data backfill. Rolling back the code needs the rename reversed; leaving the
Yandex variables unset disables Yandex without touching Meta or Google.

## Open Questions

- Which Metrica goals and Yandex-only figures the buyers want as columns. This is answered after
  the first accounts are connected and belongs to a follow-up change.
