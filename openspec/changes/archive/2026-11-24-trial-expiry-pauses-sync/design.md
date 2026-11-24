## Context

Five repositories claim background work with a Prisma `where` that selects due rows and then takes a lease with an optimistic `updateMany`: `PrismaImportJobs` and `PrismaLeadPollJobs` over `ProjectIntegration`, and `PrismaImportJobs`, `PrismaTrafficJobs` and `PrismaCheckJobs` over `SeoSite`. None of them knows the organization's tariff. The members' write guard works per request and never reaches the workers. `isTrialExpired` in `@adpulse/access-policy` is the one definition of an ended trial. See proposal.md for the motivation.

## Goals / Non-Goals

**Goals:**
- A due integration of an organization with an ended trial is never claimed.
- The rule has one definition, applied in the same query that finds due work, so a skipped row costs nothing and a resumed one needs no repair.

**Non-Goals:**
- Pausing a job that already holds a lease.
- Marking skipped integrations with a status or a banner per integration.
- Pausing the Telegram bot and the notification workers, which call no data source for the organization.

## Decisions

**Filter in the claim query, not in the worker loop.** Each `available` filter gains a condition on the organization: its tariff is not `TRIAL`, or its `trialEndsAt` is null or in the future. The first paused row would otherwise be found, then dropped by the worker, and the `orderBy` would find it again forever, starving later rows. Alternative: check `assertWritable` after claiming and release the lease. Rejected because it takes and drops a lease on every pass and moves `nextDailyAt` forward, which would lose the catch-up when a tariff is assigned.

**One shared filter.** `liveOrganizationFilter(now)` returns the Prisma condition `{ OR: [{ tariff: { not: "TRIAL" } }, { trialEndsAt: null }, { trialEndsAt: { gt: now } }] }`. It lives in `#shared/infrastructure` beside the Prisma helpers, and each repository nests it under its own path to the organization: `project.client.org` for integrations and sites. A unit test compares it with `isTrialExpired` over a table of tariffs and dates so the two definitions cannot drift apart.

**The schedule is left alone.** A skipped row is not touched, so `nextDailyAt` stays in the past and the next claim after the tariff change finds it due. Imports already fetch from the last success, so a long pause fills in on the first run.

**Manual refresh needs no change.** «Обновить» and the lead import toggle are writes, so the trial guard already answers 403 before anything is queued.

**The notice is copy only.** The existing read-only notice in `tariff-status` gains a sentence. The session already carries the tariff and `trialEndsAt`.

**The header keeps its left slot.** `AppHeader` renders its left area on every page, empty outside CRM, and gives it `mr-auto` as the CRM page does today. `TrialBanner` keeps its own `mr-auto`, so the free space splits the same way on every page and the countdown stays between the left area and the toolbar. Alternative: copy the CRM spacing into Projects only. Rejected because the next page would drift again.

**The request layer reports the refusal, a listener shows the toast.** `http.ts` knows every response but cannot reach React. It already lets `session.ts` publish events to listeners; a sibling `onTrialEnded` does the same when a response is 403 with the `TRIAL_ENDED` code, before the `ApiError` is thrown. A component in `tariff-status`, mounted once under the alerts provider, subscribes and calls `raise`. Alternative: a global `MutationCache.onError` on the query client. Rejected because it misses requests sent outside React Query, such as the auth forms and uploads, and the brief says every request.

**One toast per burst, and no generic twin.** The listener raises the trial toast only when none is on screen. Pages that catch the same `ApiError` call `raise` with their own failure text a moment later, so the alerts provider drops an error toast raised within a second after a trial toast. The window is short enough not to hide an unrelated failure. Alternative: change every call site to skip the generic message for this error. Rejected as dozens of edits that the next call site would forget.

**Inline refusals stay.** Forms that print `tariffRefusal(error)` under their fields keep doing so; the toast is added, not instead.

## Risks / Trade-offs

- A running job finishes after the trial ends → at most one extra import per integration, accepted.
- The extra join slows the claim query → each claim already scans a small indexed set of due rows, and the join adds one lookup per candidate; no new index.
- An organization sees frozen figures and may read it as breakage → the notice says why.
- The suppression window hides a real, unrelated error that lands in the same second → accepted, the window is one second and only follows a trial toast.
- The five filters drift apart → one shared helper and one test per repository.

## Migration Plan

Deploy the API. Integrations of organizations whose trial already ended stop at their next due time; nothing needs migrating. Rollback is the previous release, which resumes all of them.
