## Why

The web client downloads unchanged task attachments, repeats SEO refreshes, and reloads unrelated data after CRM changes. Hidden project sections and completed onboarding also keep making requests.

## What Changes

- Cache task image bytes by ID and share them between thumbnails and previews.
- Share one realtime connection between presence, task, and CRM subscribers.
- Coalesce CRM refreshes and avoid restarting requests already refreshing the same data.
- Refresh each changed SEO dataset once and propagate request cancellation to fetch.
- Stop completed onboarding polling and refresh active onboarding only after relevant mutations.
- Fetch project overview data only while its overview is open.
- Keep reference data fresh for a bounded period across component mounts.

## Capabilities

### New Capabilities

- `web-request-lifecycle`: Bound background traffic and share repeated reads without losing data updates.

### Modified Capabilities

None.

## Impact

Changes affect the web HTTP client, query hooks, realtime transport, onboarding, task image views, and project page composition. REST and WebSocket payloads remain compatible. No dependencies, database migrations, or breaking changes are required.
