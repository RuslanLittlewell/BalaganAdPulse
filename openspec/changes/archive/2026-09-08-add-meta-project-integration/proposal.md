## Why

Projects currently depend on locally populated advertising data. Connecting a Meta ad account lets the server keep campaign performance current without manual data entry.

## What Changes

- Add a project integration form for Meta Account ID and access token, with connection status and token replacement.
- Import campaigns, ad sets, ads and daily performance through Facebook Graph API, initially using v22.0 as supplied by the user.
- Trigger an initial import on connection, provide manual refresh, and refresh every morning at 08:00 Europe/Warsaw.
- Encrypt credentials on the server, enforce project access, prevent duplicate imports, and show safe synchronization errors.
- Preserve existing project data and stop scheduled imports when disconnected.
- No breaking API changes; database changes are additive.

## Capabilities

### New Capabilities

- `meta-project-integration`: Project-scoped Meta credentials, imports, manual synchronization and durable daily scheduling.

### Modified Capabilities

None. Existing project and campaign read contracts remain unchanged.

## Impact

API integration module, composition and shutdown wiring; Prisma schema and migration; project page and Russian localization; API documentation; deployment environment configuration and integration tests. Uses Meta Marketing API from the server only. No real access tokens belong in artifacts, fixtures or source control.
