## Why

Opening a lead card (`LeadFormDialog`) refetches the client's members, the
project's campaign names, and the board's CRM columns every single time,
even seconds after the same data was already fetched — for columns, even
though `CrmBoard` (always mounted alongside the dialog) already holds the
identical query in cache. The cause: none of the three queries set a
`staleTime`, so they default to `staleTime: 0`; combined with the dialog
fully unmounting on close and remounting fresh on every open
(`{board && editing ? <LeadFormDialog .../> : null}` in `CrmPage.tsx`),
React Query treats the cached data as stale on every remount and
re-requests it in the background.

## What Changes

- `useClientMembers`, `useCampaignReferences` and `useLeadColumns` each get
  an explicit non-zero `staleTime`, matching the pattern `useAdPreview`
  already uses in the same codebase (`staleTime: 10 * 60_000`). No other
  query is touched.
- No observable output changes — the same data renders either way. This
  only stops a request that already has fresh cached data available from
  firing again. `skip_specs: true`: this is a caching/performance fix, not a
  change to any specified requirement.

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
(none — performance fix, not a requirement change)

## Impact

- Frontend only: `apps/web/src/entities/membership/api/queries.ts`,
  `apps/web/src/entities/campaign/api/queries.ts`,
  `apps/web/src/entities/lead/api/queries.ts`, plus tests.
