## Why

Nothing in the interface says who else is working right now, so a media buyer who needs an answer from a colleague or a client has to guess whether that person is at their desk. The application already holds an authenticated realtime connection to every open session; it can carry that signal.

## What Changes

- Derive presence from authenticated API activity: every authenticated request marks its caller present, and `GET /api/auth/me` serves as the heartbeat an open session repeats.
- End a person's presence when they sign out, and when five minutes pass without a request from them.
- Publish presence over the existing realtime connection: the current roster on connect, then a message whenever somebody joins or leaves.
- Scope the roster to what the viewer may see: staff see everyone in the organization, a customer sees staff and the people of their own client companies.
- Add an online block to the header between the action buttons and the current user's own block. It shows avatars only, names appear on hover, the viewer is left out of their own roster, and a surplus beyond the visible avatars is summarized as a count.
- No breaking changes: the realtime connection, its task and lead messages, and every REST contract stay as they are.

## Capabilities

### New Capabilities
- `online-presence`: who counts as online, how presence starts and ends, who may see whom, and how the roster reaches an open session and is shown in the header.

### Modified Capabilities

None. Presence rides the connection described by `realtime-board-sync` without changing its requirements.

## Impact

- Backend: a presence registry and its sweep, a touch on the authenticated request path, a clear on sign-out, delivery filtering per connection, and composition wiring. No Prisma schema change and no new external service.
- Frontend: a presence entity holding the roster, a header widget of avatars with tooltips, a session heartbeat while the dashboard is open, and Russian labels.
- Operational: presence lives in the process memory of the API, so it is per instance and starts empty after a restart.
- Tests: presence lifetime and expiry, sign-out, roster scoping across roles and organizations, delivery over the connection, and the header's rendering and hover behavior.
