## 1. Module integrity fixes

- [x] 1.1 Revalidate notification resource access for reads, counts, read actions, and streams, with regression tests.
- [x] 1.2 Replace refresh sessions after password changes and test old-token rejection and current-session renewal.
- [x] 1.3 Add atomic document revisions, migrate existing documents, and test stale-write conflicts.
- [x] 1.4 Retain and restore document drafts, handle departure, and provide explicit conflict recovery with regression tests.
- [x] 1.5 Isolate session loads and provide bootstrap retry without clearing valid sessions, with race and outage tests.
- [x] 1.6 Guard task form submissions and verify one create while pending plus retry after failure.
- [x] 1.7 Release creative and cover object URLs, bound Blob caching, and verify cleanup and byte reuse.
- [x] 1.8 Update API documentation and affected fixtures, then run green npm test, npm run test:web, builds, and strict spec validation.
