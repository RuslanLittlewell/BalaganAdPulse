# Meta project integration

Open a project and choose **Настроить Meta API**. Enter the advertising Account ID
(with or without `act_`) and paste a token that can read the account's advertising
data. The server validates the connection and queues the first import. Credentials
are entered in the browser, sent to the API over the application's HTTPS connection,
and encrypted on the server. They are never returned to the browser.

**Обновить данные** queues a manual import. The worker checks for queued work every
minute, and the page polls its progress. Every connected account also refreshes at
08:00 Europe/Warsaw, including daylight-saving changes. If the server is unavailable
at that time, it processes overdue work on startup. Expired credentials require a
replacement token. Disconnecting deletes the saved credential and stops imports,
while preserving previously imported campaigns and metrics.

Each run imports campaigns, ad sets, ads and the last 30 completed account-local days
of spend, impressions, reach, clicks, leads and purchase revenue. The current day is
excluded. Reach is requested separately at each hierarchy level. Leads use Meta's
aggregate `lead` action; revenue uses aggregate `purchase` action values. Overlapping
action aliases are not added. Existing dashboard calculations consume these metrics.
Account and project currencies must match; no conversion is performed. A campaign
already assigned to another project causes a conflict rather than being moved.

## Server configuration

Set `INTEGRATION_ENCRYPTION_KEY` to a base64-encoded random 32-byte key. Generate it
with `openssl rand -base64 32` and store it in the deployment's secret environment.
For local Compose use the root `.env`; for native API development use `apps/api/.env`;
for the VPS put it in `/opt/adpulse/.env`, which `compose.prod.yml` passes to the API
through `env_file`, and recreate the container so it picks the value up.
The key is separate from `JWT_SECRET`. Back it up with deployment secrets. Existing
connections require the same key after restart. To rotate it, disconnect existing
accounts, change the key, restart and reconnect them with their tokens. A missing
key leaves the rest of the application usable and refuses connection writes.

`META_GRAPH_VERSION` defaults to `v22.0`, matching the connection guide. Requests go
to `https://graph.facebook.com/v22.0/act_<ACCOUNT_ID>/campaigns` and the associated
account, adsets, ads and insights endpoints. The token is carried in an Authorization
Bearer header. Configure a supported version if Meta retires this version.

Apply Prisma migrations before deploying the API, then regenerate its Prisma client.
The integration migration adds one table and indexes and does not alter existing
projects or advertising data. Render's pre-deploy migration step already handles
this. Local Compose regenerates the client and migrates on API startup. Restart the
API after a schema change. Rollback can leave the additional table unused.

## HTTP contract

All endpoints require authentication, project reach and project update permission.
An unreachable project returns 404; a reachable project without update permission
returns 403. API responses never include the saved token or ciphertext.

| Method | Endpoint | Result |
| --- | --- | --- |
| GET | `/api/projects/:id/integrations/meta` | Metadata or null |
| PUT | `/api/projects/:id/integrations/meta` | Validate `{accountId, token}`, save and queue; 200 |
| POST | `/api/projects/:id/integrations/meta/sync` | Queue manual import; 202 |
| DELETE | `/api/projects/:id/integrations/meta` | Delete credentials, stop imports; 204 |

Metadata includes Account ID, currency, timezone, status, last successful import,
safe error code and next daily time. Status is QUEUED, RUNNING, SUCCESS, ERROR or
AUTH_REQUIRED. Provider failures never expose raw Meta messages or credential URLs.
Transient failures retry after 1, 5 and 15 minutes, respecting a longer Retry-After.
After the retry budget is exhausted, the next daily or manual run can try again.

The database coordinates workers with renewable leases. Only the current lease and
credential revision can commit. Repeated imports replace daily metrics in the
refreshed window without duplicates. All required pages must be fetched and validated
before a transaction publishes any data. Requests are bounded to 30 seconds and
5 MB per response, 200 pages and 100,000 rows per endpoint, and 15 minutes per import;
exceeding a bound reports failure while retaining the prior successful data.
