## Why

Google retired Google Ads API developer tokens on 9 September 2026. Access levels now belong to
the Google Cloud project that owns the OAuth client, the `developer-token` header is ignored, and
Google has announced that a future API version will reject requests that still carry it. The
server nevertheless requires `GOOGLE_ADS_DEVELOPER_TOKEN` and sends the header with every request,
so a deployment without a token is treated as not configured.

## What Changes

- The server no longer reads `GOOGLE_ADS_DEVELOPER_TOKEN`; Google is configured by the OAuth
  client id, its secret and the redirect address alone.
- Requests to Google Ads no longer carry a `developer-token` header.
- The configuration examples and the integration guide drop the variable and explain that the
  access level is managed on the Google Cloud project.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `google-ads-project-integration`: what "not configured" means.

## Impact

- API: `shared/infrastructure/config.ts`, `modules/integrations/infrastructure/google-ads-provider.ts`.
- Configuration: `.env.example`, `apps/api/.env.example`, `docker-compose.yml`.
- Docs: `docs/google-ads-integration.md`.
