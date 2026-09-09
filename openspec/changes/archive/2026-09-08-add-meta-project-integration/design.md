## Context

See proposal.md for motivation. The current schema contains Campaign, AdSet, Ad and daily metric models; the project page consumes existing campaign and summary queries. The API uses module application ports and Prisma infrastructure adapters composed in create-container.ts. Campaign external IDs are globally unique per channel. The server already has timer cleanup during shutdown. The older sheet description in OpenSpec config does not reflect the current schema.

## Goals / Non-Goals

**Goals:** Integrate with existing reads; persist jobs in PostgreSQL; keep provider credentials server-side; preserve history and make repeated imports safe.

**Non-Goals:** Creating or editing advertising in Meta, OAuth onboarding, other providers, currency conversion, arbitrary historical backfills and importing individual CRM leads.

## Decisions

### Module and endpoints

Create an integrations module with provider, credential cipher, repository and clock ports. Compose its implementations at the application root. Use GET, PUT and DELETE `/api/projects/:id/integrations/meta` plus POST `/api/projects/:id/integrations/meta/sync`. PUT verifies access and account metadata before saving and queues the first job; POST returns 202 with safe status. GET exposes account ID, currency, timezone, status, last success, safe error and next scheduled time. All endpoints check reach before project update permission. Follow existing audit conventions for connection changes without recording secrets. Reuse the current project read APIs rather than adding parallel dashboard data.

### Credentials and provider access

Use AES-256-GCM with a dedicated base64 32-byte `INTEGRATION_ENCRYPTION_KEY` environment secret, random nonce and project ID as authenticated context. Missing configuration disables connection writes with a safe error, rather than storing plaintext. Never reuse JWT secrets. Normalize Account ID and accept only digits; never accept a user-supplied URL. Use a configured Graph version defaulting to v22.0, a fixed HTTPS Graph origin and Authorization Bearer headers. Reconstruct pagination requests from cursors on the fixed endpoint instead of following arbitrary next URLs. Disable redirects, bound response sizes, pages and timeouts, validate provider payloads and redact provider errors. Do not run the supplied real token through browser or search tooling.

### Import mapping and transaction

Read account currency/timezone, campaign hierarchy and three Insights levels with explicit fields and `time_increment=1`. Fetch the last 30 completed account-local days on each run, so attribution corrections replace prior values. Use aggregate lead actions and purchase action values only; do not add aliases. Keep monetary strings as Decimal and validate integer counts. Map ACTIVE to ACTIVE, paused statuses to PAUSED, archived/deleted to ENDED, disapproved to REJECTED, pending statuses to LEARNING; unrecognized statuses fail validation pending an explicit mapping.

Stage the complete validated result before a short database transaction. Resolve campaign IDs by existing channel/externalId, reject foreign-project conflicts, and resolve ad sets/ads within their parents under the project import lock. Append positions for new entities; retain local IDs, tasks, manual entities and historical metrics. Upsert entity/day metrics, clearing stale imported values within the refreshed window only after a complete response. Never delete an entity merely because it is absent from a response. Verify currency equals project budgetCurrency before writing. Fetching only campaigns was rejected because it would leave existing drill-downs and performance views empty.

### Durable worker

Add a one-to-one ProjectIntegration row with encrypted token, normalized account ID, account metadata, credential revision, last success/error, queued time, next daily due time, retry count, lease owner and lease expiry. A small worker started by server.ts polls once per minute and claims jobs atomically in PostgreSQL. Renew leases during long fetches; every commit checks owner, expiry and credential revision. Expired leases can be reclaimed after crashes. Manual, initial and scheduled jobs share the claim mechanism. Replacement and disconnect invalidate ownership. A successful manual run does not erase the upcoming daily run.

Compute 08:00 Europe/Warsaw as a local-calendar occurrence, not a 24-hour UTC interval. Retry transient failures after 1, 5 and 15 minutes, honoring longer provider Retry-After values. Exhausted attempts preserve a failure status until the next morning or manual request. Authentication failures suppress automatic attempts until replacement. On shutdown stop polling and drain or abort active requests before Prisma disconnect. A bare in-memory daily timer was rejected because restarts and multiple instances would lose or duplicate work.

### Frontend

Add a project integration feature using existing form/dialog primitives and permission gates. Account ID and password-type token inputs support connect and replacement; the saved token is never refilled. Clear token input after submission and on close, and avoid persistence in query keys or mutation caches. Provide disconnect, refresh and status polling while queued/running. Invalidate campaign hierarchy and summary queries on successful completion. All visible copy belongs in shared/config/ru.ts.

## Risks / Trade-offs

- Meta version retirement or account-specific permissions → configurable version, fixture contract tests, safe provider failures; verify v22.0 support before a live test.
- Large accounts → bounded fetches and explicit failure instead of partial data; asynchronous Insights can be added if production evidence requires it.
- Global campaign uniqueness → return a generic conflict for campaigns already linked elsewhere; no destructive ownership transfer.
- Currency mismatch → explain required project currency alignment; never mix or implicitly convert currencies.
- Token expiry and lost encryption keys → visible replacement flow; document secret backup and rotation by re-encryption or reconnect.
- Thirty-day window → older attribution corrections require a later explicit backfill feature.

## Migration Plan

Add the integration table and project foreign key with cascade deletion and due-work indexes. No existing rows are deleted or rewritten; no changes to existing campaign uniqueness. Generate Prisma client, apply migration against a populated test database, and verify old data survives. Add the encryption-key setting to deployment templates without an actual value and document schedule/version defaults. Deploy the migration before the application. Rollback stops worker code and leaves the additive table inert; retain the table and encryption key until recovery is no longer needed.

## References

- [Meta's Marketing API collection](https://www.postman.com/meta/facebook-marketing-api/documentation/0zr4mes/facebook-marketing-api-mapi) documents Bearer authentication and daily Insights requests.
- [Meta campaign SDK source](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/campaign.py) provides campaign fields and Insights parameters.
