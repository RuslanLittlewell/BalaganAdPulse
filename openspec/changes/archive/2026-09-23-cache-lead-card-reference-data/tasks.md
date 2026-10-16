## 1. Stop refetching cached reference data on every lead-card open

- [x] 1.1 Write and observe a failing test per hook (members, campaign
  names, columns): render the hook, let it succeed, unmount it, then render
  it again against the same `QueryClient` (mirroring the dialog's
  unmount-then-remount) — the fetcher SHALL be called only once, not twice.
- [x] 1.2 Add `staleTime: 5 * 60_000` to `useClientMembers`
  (`apps/web/src/entities/membership/api/queries.ts`),
  `useCampaignReferences` (`apps/web/src/entities/campaign/api/queries.ts`)
  and `useLeadColumns` (`apps/web/src/entities/lead/api/queries.ts`).
- [x] 1.3 Run `npm run test:web` until green. 134 files / 1105 tests.
