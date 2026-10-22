# Google Ads project integration

Open a project, press **Добавить интеграцию** and choose **Google**. The browser goes to
Google, where the member signs in with an account that can read the advertising account,
and returns to the project. The project then offers the accounts that sign-in reaches;
choose one and press **Подключить**. The server verifies the account, takes its currency
for the project, and queues the first import.

Every connection holds the credential of the sign-in that made it. Signing in on one
project gives no access on another, and nothing is shared across the organization. The
refresh token Google issues is encrypted on the server against the project, with the same
`INTEGRATION_ENCRYPTION_KEY` as Meta tokens, and is never returned to the browser.

Imports follow the Meta ones: a manual refresh, a daily run at 08:00 Europe/Warsaw, the last
30 completed days in the account's time zone, no partial publication, and disconnecting
keeps what was imported. Each run reads campaigns, ad groups, ads and their daily cost,
impressions, clicks, conversions and conversion value. Cost arrives in millionths of the
currency and is stored with four decimals. Conversions are rounded to whole numbers and also
fill the results column. Google does not report reach at every level, so reach stays zero.
Leads from lead form extensions are not imported.

## Creatives

Creatives are not read by the daily import. The first time someone opens an ad's preview the
server reads the ad from Google Ads, with the same credential, and keeps the result: an image
ad gives its image; responsive display and Demand Gen ads give their images, marketing ones
before square ones, and their YouTube videos; video ads give their YouTube videos; search and
text ads give their headlines and descriptions as one text creative. Images are copied into the
system's storage like Meta's. A YouTube video is not copied: its thumbnail is stored, and the
preview shows it with a link to watch the video on YouTube. Google offers no API for rendering an
ad as the audience sees it, so there is no rendered preview, and the ads of Performance Max
campaigns, which have none of their own, and ad types not listed here show nothing.

When Google rejects or revokes the credential, the connection keeps its data and shows that
it needs a new sign-in. **Google Ads API → Войти заново** signs in again on the same
connection.

## Server configuration

| Variable | Meaning |
|---|---|
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | The OAuth client of the Google Cloud project, of type web application |
| `GOOGLE_OAUTH_REDIRECT_URI` | Optional. Defaults to `APP_URL` + `/api/integrations/google/callback` |
| `GOOGLE_ADS_API_VERSION` | Optional. Defaults to `v24`; set a supported version when Google retires it |

Without the client id and its secret, connecting Google answers with a configuration error and
Meta is unaffected.

Google retired developer tokens on 9 September 2026. Requests carry none: the access level is that
of the Google Cloud project owning the OAuth client, shown and upgraded on the project's Google Ads
API Overview page in the Cloud console. Test reads test accounts only; Explorer, granted
automatically on request, also reads production accounts within 2,880 operations a day; Basic
needs the project's brand verification; Standard needs Google's review. A
`GOOGLE_ADS_DEVELOPER_TOKEN` left in an environment is ignored.

In the Google Cloud console enable the Google Ads API, create the OAuth client, add the
redirect address above to its authorised redirect URIs, and configure the consent screen with
the scope `https://www.googleapis.com/auth/adwords`. Until the consent screen is verified,
Google limits the application to test users and expires its refresh tokens after seven days.
At the Test access level only test accounts can be read.
