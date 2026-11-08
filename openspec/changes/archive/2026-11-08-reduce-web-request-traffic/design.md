## Context

See proposal.md for motivation. React Query already deduplicates reads by key, but attachment downloads bypass it, SEO effects run per observer, and independent realtime hooks each own a socket. CRM events currently identify only a board. Onboarding subscribes to every successful mutation.

## Goals / Non-Goals

Preserve authorization, reconnect recovery, and mutation feedback while bounding background work. Keep the session heartbeat because it records presence. Do not change database storage or add dependencies.

## Decisions

- Cache image Blobs in React Query by image ID and create object URLs per mounted consumer. This gives thumbnails and previews shared bytes with independent URL cleanup and session cache clearing.
- Share the realtime transport by socket factory, reference count consumers, and broadcast parsed messages to subscribers. Cache the latest presence snapshot for late subscribers. Keep injected factories isolated for tests.
- Coalesce CRM invalidations over a short fixed window. Add optional resource scopes and a lead ID to CRM events, with a full refresh fallback for old events and reconnects. Pass cancelRefetch false to reuse ongoing refreshes. Scoped events avoid reloading columns and files after ordinary card edits.
- Compare SEO status snapshots once in the query cache's update stream per QueryClient. Select invalidation families by the changed timestamps. This also handles cache writes after manual imports and avoids effects per observer. Propagate AbortSignal through HTTP and the affected query APIs.
- Mark onboarding-related mutations through metadata. Stop polling when the welcome is recorded and steps are hidden or complete. Retain a minute polling interval while steps remain and restore optimistic marks on failure.
- Mount the project overview separately from the shared project header and documents section. Overview hooks then follow component lifetime without adding enabled flags to unrelated APIs.
- Set bounded freshness for reference queries rather than changing all query defaults. Keep live metrics and event recovery semantics explicit.

## Risks / Trade-offs

- Cached image bytes consume memory: use finite garbage collection and clear the query cache on session changes.
- CRM refreshes appear after a short coalescing window: keep the window below one second and cancel pending work when leaving a board.
- Older servers omit CRM scopes: preserve full invalidation for those events.
- Longer reference freshness can hide external edits briefly: retain bounded freshness and explicit write invalidation.

## Migration Plan

Deploy compatible optional CRM event fields with the web changes. Existing event readers ignore the added fields, and the new web client supports old events. No database migration is needed; all existing data survives. Roll back the application build to restore the previous request lifecycle.
