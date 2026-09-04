## Context

The API is hexagonal: `modules/<name>/{domain,application,infrastructure,presentation}`,
wired in `composition/`. An architecture test forbids domain and application code
from importing Express, Prisma, Zod or S3, so the socket library must stay in
infrastructure and never appear in a use case.

Two existing pieces are directly reusable:

- `AuthenticationPort.authenticate(accessToken)` → `SessionPrincipal`
- `ActorResolutionPort.resolveActor(principal)` → `ActorContext`

These are what the HTTP middleware chain already calls on every request. The
handshake and the delivery filter use the same two ports, so a socket cannot end
up with a different notion of who the caller is than a request would.

## Goals / Non-Goals

**Goals**

- Live task changes for members with the board open.
- Delivery authorization no weaker than the REST path's.
- Remove the per-move refetch.

**Non-Goals**

- Presence, cursors, or "X is editing" indicators.
- Realtime for any other resource (clients, campaigns, records).
- Horizontal scale-out. The registry is in-process; a second API instance would
  serve its own connections only. Noted below as a known limit.
- Guaranteed delivery. Events are best-effort; the reconnect refetch is what
  makes a missed event recoverable.

## Decisions

### Publish after commit, from the use case

The `TaskEventPublisher` port is called by the use case *after* `unitOfWork.run`
returns, not inside the transaction.

Inside the transaction the event would be published for work that may still roll
back — every recipient would apply a change that never happened, and nothing
would correct them until a reconnect. After the commit, the worst case is a
published event whose delivery fails, which is what the reconnect refetch exists
to repair. Losing an event is recoverable; broadcasting a lie is not.

The move use case already returns the placement it made rather than re-reading
(a re-read would run outside the transaction). The published event carries that
same value, so the event and the HTTP response cannot disagree.

### Entitlement is evaluated per delivery, not per connection

`resolveActor` is called on **every** request rather than once per token, and the
codebase comments say why: a demotion or suspension has to take effect on the
next call, not whenever a fifteen-minute token expires. A long-lived socket makes
that worse, not better — it can outlive several token lifetimes.

So delivery re-resolves the actor and re-checks project reach per event, per
connection. This is deliberately the expensive choice: it costs roughly two
queries per connected member per task change. At this board's scale — an agency
team, a change on drop rather than on drag — that is the same cost profile as the
members having made one request each, and it is the only option that keeps the
socket's authorization identical to the REST path's.

If that ever becomes the bottleneck, the fix is a short-TTL cache of resolved
actors keyed by membership, invalidated on membership and grant writes — not
sealing the actor into the connection.

The filter order mirrors the REST path: organization, then the `task.read` verb
from `@adpulse/access-policy`, then project reach. A member who cannot reach a
task receives nothing at all, which is the socket's equivalent of the 404 the
REST path gives instead of a 403.

### One registry, addressed by connection

The registry is a plain in-process set of connections, each holding its
`SessionPrincipal` and a send function. It has no notion of rooms or topics:
subscription is implicit in being connected, and what a connection receives is
decided entirely by the delivery filter. Rooms keyed by organization or project
would be a second, weaker copy of the authorization rules, and would go stale the
moment a grant changed.

### The event carries the task

An event carrying only `{ id }` would force every recipient to fetch the task,
which is the request this change exists to remove — and would multiply it by the
number of viewers. The event carries the stored row, and because it is only
delivered to entitled connections, carrying the payload leaks nothing that a
`GET /api/tasks` would not have returned to that same member.

### The originator receives its own event

No echo suppression. The mover's optimistic state is a guess about positions; the
event carries what was actually stored. Applying it is idempotent and replaces
the guess with the truth, which is exactly what the removed refetch used to do —
at no extra request.

### Authenticated at the upgrade, from the session cookie

The access token lives in an HttpOnly cookie, which the browser attaches to the
upgrade request automatically. The server reads it there — the same cookie the
REST middleware reads — and accepts or refuses the upgrade before any socket
exists.

This is what the `WebSocket` constructor's inability to set an `Authorization`
header would otherwise have forced us around. A query parameter was rejected
outright: it puts the token in the request line, where proxy and platform access
logs record it verbatim. Sending it as a first message on an
as-yet-unauthenticated socket was the fallback, and is no longer needed now that
the cookie carries it: there is no token in the page to send, no window in which
an accepted socket is still unauthenticated, and no timeout to enforce.

A refused upgrade is answered with a bare 401. Unknown, expired, tampered,
malformed and absent are indistinguishable, as they are on the REST path.

The cookie's name is imported from the identity module rather than repeated in
the transport: a rename there must not leave the socket authenticating against a
cookie that no longer exists, which would fail silently as "nobody is entitled".

## Risks / Trade-offs

- **Single instance only.** The registry is in-process, so with more than one API
  instance a member connected to instance A never learns of a change committed
  through instance B. Today the service runs as one instance. If it is scaled,
  this needs a shared broker (Postgres `LISTEN/NOTIFY` is already available and
  would be the smallest step) before the board can be trusted across instances.
  Mitigation until then: the board still converges on reconnect and on reload.
- **Per-delivery queries.** Chosen knowingly; the escape hatch is described above.
- **Best-effort delivery.** A member whose socket drops mid-change misses the
  event and is corrected by the reconnect refetch, not by a replay log.
- **Removing the post-move refetch** means a bug in the optimistic reducer is no
  longer papered over by a refetch a moment later. That is the point — but it
  does mean the reducer's tests are now load-bearing.

## Migration Plan

Additive. The REST endpoints are unchanged, and a client that never opens a
socket behaves exactly as before except for the removed refetch. No migration or
data change.

Deployment needs the platform to pass WebSocket upgrades through to the API
service; the dev proxy needs `ws: true` on the `/api` route.

## Open Questions

None blocking. Scale-out is deferred deliberately and recorded above.
