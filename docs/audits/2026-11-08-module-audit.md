# Module reliability and access audit

The audit covers identity and access, project documents, task forms, CRM boards, integration workers, notifications, reports, and creative media. It records the working tree after the web request lifecycle changes and before the module integrity fixes.

Eight findings were reproduced through ten focused checks. One additional check confirmed that session cookie detection handles a preceding cookie correctly. Two performance findings follow from the code; their production impact has not been measured. The audit did not modify application code or the earlier implementation changes.

## Confirmed findings

### F1. P1: Old notifications expose new data after project access is revoked

Location: `apps/api/src/modules/notifications/infrastructure/prisma-notifications.ts:65` and its `shown` projection at line 16.

Notification reads filter by recipient ID, then join current project names, task titles and document titles. They do not check whether that recipient can still read the referenced resource.

Reproduction: give a manager project access, store a legitimate project notification, revoke the access, and rename the project. The project list excludes the project, but `GET /api/notifications` returns its new private name. The API reproduction passed against the isolated test database.

Repair: apply current resource authorization to notification reads and their projections. Keep list and unread-count behavior consistent. Assess stream delivery with the same authorization rule.

### F2. P1: Changing the password leaves previous refresh sessions usable

Location: `apps/api/src/modules/identity/application/identity-use-cases.ts:193`.

The profile update changes the password hash and issues an access token without revoking or rotating refresh sessions. Refresh tokens have a 30-day expiry. Changing the password does not terminate someone else's existing session.

Reproduction: register, change the password through `PATCH /api/user/profile`, confirm that the old password no longer signs in, and use the original refresh token. Refresh and the resulting authenticated session still succeed. The API reproduction passed.

Repair: revoke previous refresh sessions when changing the password and issue a replacement session for the current device. Decide whether access-token versioning is also needed for immediate revocation.

### F3. P1: Autosave can lose edits while reporting a successful save

Location: `apps/web/src/widgets/project-documents/useAutosave.ts:16`.

The hook removes a patch from its pending state before the request succeeds. A failed patch is not restored. Success also sets the status to saved without checking for newer queued edits. The only departure flush is React effect cleanup; browser page lifecycle events have no handler.

Three reproductions passed:

- A content save fails. A later title-only patch succeeds. The status becomes saved while stored content remains unchanged, and unmounting does not retry the failed content.
- A first write finishes while a newer title is waiting in the debounce queue. The status becomes saved although that newer edit has not been sent.
- A pagehide event arrives during the 800 ms debounce window. No save is started. This demonstrates the missing page-lifecycle flush; real browser shutdown was not simulated.

Repair: retain dirty changes until acknowledgment, merge failed patches without replacing newer edits, and derive status from all pending work. Preserve recoverable drafts across page reloads and closing. Existing mutation scopes already serialize requests from one document editor; the finding concerns dirty-state tracking and recovery.

### F4. P1: Two document editors can silently overwrite each other's work

Location: `apps/api/src/modules/project-documents/application/project-document-use-cases.ts:71` and `apps/api/src/modules/project-documents/infrastructure/prisma-project-document-repository.ts:75`.

Document updates carry no expected revision. The repository updates by ID and replaces the supplied content, regardless of whether another editor changed it after the caller read it.

Reproduction: read the same document twice, save the first editor's content, then save a draft based on the second read. Both PATCH requests return 200. The final content contains only the second draft. The API reproduction passed using two snapshots of the same document.

Repair: require a revision or expected updatedAt, return a conflict for stale saves, and keep the local draft available for recovery or merging.

### F5. P2: A late session response overwrites a newer sign-in

Location: `apps/web/src/features/auth/model/AuthProvider.tsx:56`.

Session loading has neither cancellation nor a session-generation check. Its response always writes the user, organization, role, grants, and modules into context.

Reproduction: hold the initial session response for user A, sign out, sign in as user B, then release A's response. The context changes back from B to A. The frontend reproduction passed. This confirms stale client identity state, not an API authorization bypass.

Repair: invalidate old session loads on logout and new login, and apply a response only if it belongs to the current session generation.

### F6. P2: A temporary bootstrap failure signs the user out

Location: `apps/web/src/features/auth/model/AuthProvider.tsx:83`.

The initial session load routes every rejection through endSession, including temporary server and network failures.

Reproduction: respond 503 to the initial `/api/auth/me` request while a session marker exists. The marker is cleared. The frontend reproduction passed.

Repair: distinguish definitive authentication refusal from temporary unavailability, retain the session during temporary failures, and provide a retry state.

### F7. P2: Repeated task submission sends repeated creates

Location: `apps/web/src/features/task-management/ui/TaskFormDialog.tsx:239`, submit handling at line 396, and buttons at lines 512 and 794.

The form does not use isSubmitting or mutation-pending state to prevent repeated submission. The create path has no idempotency key.

Reproduction: keep the first task POST waiting and click the create button again. The button remains enabled, and two POST requests are sent for the same draft. The frontend reproduction passed.

Repair: guard the submit handler and disable both submit controls while saving. Consider server idempotency for retries whose first response was lost. Review the separate move-then-update save sequence for atomicity as part of that work.

### F8. P2: Creative media object URLs are never released

Location: `apps/web/src/entities/campaign/api/queries.ts:105` and `apps/web/src/entities/campaign/api/api.ts` (`creativeFile`). Report covers have the same URL-returning pattern in `apps/web/src/entities/report/api/api.ts` and `queries.ts`.

Creative file queries retain object URLs with infinite garbage-collection time. Closing the preview does not release them. Clearing the query cache removes its entries without revoking those URLs. Report-cover cache entries also lack URL cleanup.

Reproduction: load a creative, unmount its consumer, and clear its query cache. No revokeObjectURL call occurs. The frontend reproduction passed. The report-cover path was inspected, not separately reproduced.

Repair: cache Blobs with finite retention and let each mounted consumer create and release its own URL, as the task-image implementation now does.

## Performance work requiring measurement

### F9. CRM mutations read the whole board while holding its write lock

Locations: `apps/api/src/modules/leads/application/board-mutation.ts:18` and `apps/api/src/modules/leads/infrastructure/prisma-lead-repository.ts:58`.

Every board mutation acquires an advisory lock and reads all board leads with their relations, even for a small card edit. The list endpoint also has no pagination. The cost grows with the board, and concurrent mutations on that board wait behind this work.

Next check: profile read size, query duration, and lock wait time with representative large boards. Separate record edits from operations that require board-wide ordering. Add bounded reads and pagination where the UI permits them.

### F10. Advertising imports perform sequential queries for each entity

Location: `apps/api/src/modules/integrations/infrastructure/prisma-import-jobs.ts:50`.

Each campaign needs a lookup and a write. Each new ad set and ad also needs a position aggregate. These operations run sequentially inside a transaction with a 60-second timeout. A snapshot containing 10 new campaigns, 100 new ad sets, and 1,000 new ads entails roughly 3,320 entity queries before metric replacement and transaction bookkeeping.

Next check: measure large account imports, preload existing IDs and positions, and batch writes. Preserve the existing lease-owner and revision checks. The inspected worker already renews leases, aborts lost work, and applies bounded retries; no duplicate-import defect was reproduced.

## Validation and limits

- Eight focused frontend checks passed: seven defect observations and one cookie-detection sanity check.
- Three API checks passed against isolated test schemas: revoked access through notifications, refresh after password change, and stale document writes.
- Temporary reproduction files were removed after execution. The results describe the audited state; passing these checks means the observations were reproduced.
- No production account, traffic, browser shutdown, large-board benchmark, or import benchmark was used.

## Resolution

F1 through F8 are implemented under the module-data-integrity and project-documents specifications. Regression coverage includes revoked notification access and stream checks, refresh-session replacement, atomic document conflicts, recoverable autosave queues and both conflict choices, session races and outages, duplicate submission, and creative and cover URL cleanup. The document revision migration preserves existing documents and requires API and web to be released together. Existing access tokens retain their configured expiry after a password change.

F9 and F10 remain performance candidates for measurement. No large-board or import benchmark supports a query redesign yet.
