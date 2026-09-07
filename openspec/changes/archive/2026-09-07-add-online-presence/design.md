## Context

The API already authenticates every REST request and holds an authenticated WebSocket
connection per open session, with per-connection entitlement filtering for task and
lead events (`realtime-board-sync`). Presence needs no new transport and no new
credentials; it needs a place to remember when each person was last seen and a rule for
who may learn about whom. See proposal.md - Why for the motivation.

## Goals / Non-Goals

**Goals:**

- Presence that follows real API activity rather than the lifetime of a socket, so a
  browser left open with a dead network stops counting as online.
- One entry per person, whatever number of tabs and devices they have open.
- A roster that reaches an open session without polling and that never discloses a
  person the viewer may not know about.

**Non-Goals:**

- Persisting presence, reporting historical presence, or "last seen at" for offline
  people.
- Idle or away states, typing indicators, or per-page presence.
- Migrating the existing `useTaskEvents` and `useCrmEvents` hooks onto the shared
  realtime channel introduced here.

## Decisions

**Presence lives in the API process memory, keyed by user.** A map of user to last-seen
instant plus the display fields the roster needs. Postgres and Redis were both
considered and rejected: presence is ephemeral, is rewritten several times a minute per
person, and matters only while the process serving the socket is alive. One process
serves the API today, so its memory is the whole truth. The cost is stated under Risks.

**Every authenticated request refreshes last-seen, not only `GET /api/auth/me`.** The
rule the feature is specified against is "five minutes without a request", so any
request has to count; `me` is simply the request an idle session repeats. The touch sits
where the request's actor is already resolved, so no endpoint has to opt in and no
endpoint can forget to.

**Departures are swept, not computed on read.** A timer runs every 30 seconds, removes
whoever has been silent for five minutes and publishes their departure. Computing
expiry lazily when a roster is read would leave an open session showing a stale avatar
indefinitely, since nothing would prompt the read. The sweep interval is a quarter of
the window: a departure is visible within about half a minute of it being true, at the
cost of one timer.

**The browser heartbeats with the session request it already has.** While the dashboard
is mounted, the web app re-issues `GET /api/auth/me` every two minutes. That is well
inside the five-minute window, so a single failed or slow beat does not drop the person,
and it reuses an endpoint whose response the app already knows how to apply. A dedicated
`POST /presence/ping` was considered and rejected as a second way to say the same thing.

**A roster entry carries identity, name and whether an avatar exists.** The web already
draws member avatars from `/api/members/:membershipId/avatar` with a name fallback, so
the entry carries the membership identifier, the display name and an avatar flag. It
deliberately does not carry the image itself, so a roster message stays small.

**Scoping reuses the reach the session endpoint already computes.** Staff see everyone
in the organization. A customer sees staff plus the people of the client companies they
reach. This mirrors how CRM boards are scoped, and it keeps one client's people from
learning that another client's people are at work.

**Delivery filters per connection, like task and lead delivery.** The same shape as
`createTaskEventDelivery`: ask each open connection whether it is entitled, then send.
Entitlement is evaluated per message rather than cached on the connection, so a role or
grant changed mid-session takes effect on the next message.

**New realtime code on the web goes through one shared channel module.** Presence is the
third consumer of the same connect-listen-reconnect logic; rather than copy it a third
time, this change adds a shared channel in `shared/lib` and builds presence on it. The
two existing hooks keep their own copies for now - moving them is a refactor with its
own risk, and it is listed as a non-goal above.

## Risks / Trade-offs

- **More than one API instance would each hold their own roster** -> Today one process
  serves the API, so the roster is complete. Running a second instance would split it;
  the fix at that point is a shared store behind the same registry interface, which is
  why presence is reached through an interface rather than a module-level map.
- **A restart empties the roster** -> Sessions re-touch on their next request, and the
  heartbeat guarantees one within two minutes, so the roster refills on its own.
- **A person reading a long report without touching the API drops off after five
  minutes** -> The heartbeat runs on a timer, not on user interaction, so an open
  dashboard keeps its owner online whether or not they are clicking.
- **The sweep timer would keep a test process alive** -> The registry exposes its
  interval and its clock, tests drive the sweep directly, and shutdown clears it with
  the rest of the process's timers.
- **Presence discloses that a colleague is at work** -> This is the point of the
  feature, but it is bounded by the scoping rule: never across organizations, and never
  across client companies.

## Migration Plan

No Prisma schema change, so there is nothing to migrate and no data to preserve. The
change is additive: an older browser against the new API simply never subscribes, and
the new browser against an older API receives no presence messages and shows an empty
block. Rolling back is removing the header block; nothing else depends on the roster.
