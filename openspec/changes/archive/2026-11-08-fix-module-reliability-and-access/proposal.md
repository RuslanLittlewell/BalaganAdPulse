## Why

The module audit reproduced unauthorized notification disclosure, reusable refresh sessions after password changes, lost document edits, stale identity state, duplicate task submissions, and unreleased media URLs. These defects affect access control and saved work.

## What Changes

- Authorize notification reads, counts, and stream deliveries against current access.
- Revoke previous refresh sessions and replace the current session when a password changes.
- Retain failed and pending document edits, restore scoped local drafts, and handle page departure.
- **BREAKING**: Require an expected document revision on PATCH and reject stale writes with 409.
- Ignore stale session loads and preserve sessions through temporary bootstrap failures with a retry state.
- Prevent repeated task form submission and release creative and cover URLs with their views.

## Capabilities

### New Capabilities

- `module-data-integrity`: Current authorization, recoverable document edits, session lifecycle isolation, and bounded media lifetimes.

### Modified Capabilities

- `project-documents`: Reject stale document revisions and preserve unsaved drafts.

## Impact

Changes affect identity, notifications, project documents, task forms, and media consumers in API and web. A document revision migration preserves existing documents. Existing access tokens retain their current 15-minute lifetime; revoked refresh tokens cannot renew them. The two unmeasured database performance candidates remain outside this change.
