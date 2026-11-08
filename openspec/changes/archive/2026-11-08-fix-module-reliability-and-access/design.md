## Context

See proposal.md and the module audit. Existing document mutation scopes serialize one editor's requests but do not retain failed patches or protect against other editors. Notifications join current resource labels without rechecking reach. Session state uses unguarded async loads.

## Goals / Non-Goals

Close the eight reproduced issues with regression coverage. Preserve existing working-tree changes. Do not redesign CRM queries, import batching, or collaborative rich-text editing.

## Decisions

- Resolve current recipient membership and use resource reach predicates for notification lists, counts and read actions. Revalidate streamed notifications before delivery, including unsubscription while validation is pending.
- Revoke refresh sessions in the password-update transaction and issue a full replacement token pair. Keep the documented access-token expiry rather than introduce token versioning in this change.
- Add an integer document revision with atomic compare-and-increment. Require expectedRevision on PATCH, report 409 on stale writes and include revision on full document responses. A revision avoids timestamp precision ambiguity.
- Keep one autosave request active, merge new edits behind it, and retain failed edits. Persist scoped drafts in local storage and restore them with their base revision. Flush on pagehide and visibility changes; local drafts cover failed or interrupted departure writes. Report storage failure instead of claiming a recoverable save.
- On conflict, preserve the draft and let the member explicitly keep their version against the latest revision or load the server version. Never automatically overwrite a competing edit.
- Guard session loads with request generations and cancellation. Model bootstrap errors explicitly and render a retry action while retaining authentication markers.
- Use a synchronous form-submit lock as well as disabled submit buttons. Reuse cached Blobs for media, create object URLs per mounted view, and revoke them on cleanup.

## Risks / Trade-offs

- Local storage can be unavailable or full: catch failures and surface an unsaved-draft error; server acknowledgments still clear durable drafts.
- A conflict needs user action: keep the local text visible and recoverable until the member chooses a version.
- Old access tokens last until their existing expiry: refresh revocation prevents further renewal.
- Old document clients omit expectedRevision: reject their PATCH requests rather than silently accept unprotected writes.

## Migration Plan

Add project_document.revision with default 1. All existing documents and their contents survive. Generate Prisma clients, deploy the additive migration, and release API and web together because PATCH now requires a revision. Roll back API and web together; the additive column can remain without affecting previous code. Apply migrations only to the isolated test database during validation.
