Every implementation task follows TDD: add the focused failing test, observe it fail, then add the
minimum implementation. Existing HTTP contracts remain characterization tests throughout.

## 1. Event contract and publisher port

- [x] 1.1 Write failing domain tests for the task event shape: create/update/move carry the stored task, delete carries the identifier, and every event carries its organization and project.
- [x] 1.2 Implement the framework-free task event type and the `TaskEventPublisher` port.
- [x] 1.3 Write failing application tests proving each of create, update, delete and move publishes exactly one event, after the transaction commits.
- [x] 1.4 Write the failing application test proving a rolled-back change publishes nothing.
- [x] 1.5 Wire the publisher through the task use cases and make 1.3–1.4 pass; keep the move event's payload the placement the use case returns, not a re-read.
- [x] 1.6 Run `npm test` — green.

## 2. Connection registry and delivery authorization

- [x] 2.1 Write failing tests for the connection registry: add, remove, and iterate connections without leaking a closed one.
- [x] 2.2 Implement the in-process registry with no transport imports.
- [x] 2.3 Write failing tests for the delivery filter covering organization mismatch, a role without `task.read`, a project the member holds no grant over, and an entitled member.
- [x] 2.4 Write the failing test proving entitlement is re-evaluated per event: an actor entitled at connect time and revoked afterwards receives nothing.
- [x] 2.5 Implement the delivery filter over the actor-resolution and project-reach ports, ordered organization → verb → reach.
- [x] 2.6 Run `npm test` — green.

## 3. WebSocket transport and composition

- [x] 3.1 Add the `ws` dependency to `apps/api` and install so the lockfile is updated.
- [x] 3.2 Write failing tests for the handshake: the first message must carry a valid token; missing, malformed, expired and unknown tokens are all closed the same way.
- [x] 3.3 Write the failing test proving a connection that sends no token within the window is closed.
- [x] 3.4 Implement the WebSocket adapter: upgrade handling, first-message authentication, registry membership, and cleanup on close.
- [x] 3.5 Write the failing composition test proving the socket endpoint is attached to the HTTP server and the publisher reaches the transport.
- [x] 3.6 Wire the realtime module in the composition root and expose it only through its public surface.
- [x] 3.7 Extend the shutdown drain to close open sockets before the server closes, and prove it with a failing test first.
- [x] 3.8 Verify the architecture test still passes: no transport import outside infrastructure, no module private-path import.
- [x] 3.9 Run `npm test` — green.

## 4. Board subscription on the client

- [x] 4.1 Write the failing test proving the task cache applies an incoming create, update and move event, and removes a task on delete.
- [x] 4.2 Implement the event-to-cache reducer beside the existing optimistic reducer, reusing it where the shapes agree.
- [x] 4.3 Write the failing test proving `useMoveTask` no longer refetches the task list on settle and writes the response into the cache instead.
- [x] 4.4 Remove the post-move invalidation and make 4.3 pass.
- [x] 4.5 Write failing tests for the subscription hook: it authenticates with a fresh token, applies events, and tears the socket down on unmount.
- [x] 4.6 Write the failing tests for reconnection: it retries with increasing delay up to a bound, and refetches the task list once on reconnect.
- [x] 4.7 Implement the subscription hook and mount it on the board.
- [x] 4.8 Add `ws: true` to the dev proxy's `/api` route so upgrades reach the API in development.
- [x] 4.9 Run `npm run test:web` — green.

## 5. Acceptance

- [x] 5.1 Confirm every scenario in the capability spec is covered by a test, and name the test for each.
- [x] 5.2 Document the realtime module, its authorization rule and the single-instance limit in the README architecture section.
- [x] 5.3 Run `openspec validate add-realtime-task-board --strict`.
- [x] 5.4 Run `npm test`, `npm run test:web`, `npm run build`, `npm run build:web` — all green.
