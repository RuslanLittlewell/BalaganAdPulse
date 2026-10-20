## Context

The history window (`widgets/activity-log-modal`) is opened only from the app header and lists
`GET /api/audit` without filters. The API already filters by project and by actor and scopes
what a reader reaches: an admin reaches the whole organization, anyone else the events of the
clients and projects they were granted.

Presence lives in an in-memory registry: a member is present while an authenticated request
from them arrived in the last five minutes, an open tab asks `GET /api/auth/me` every two
minutes, and a sweep every 30 seconds drops whoever fell silent. Arrivals and departures are
announced over the realtime connection and then forgotten.

## Goals / Non-Goals

**Goals:** two tabs with a project and a person select; arrivals and departures kept in the
trail with honest times.

**Non-Goals:** translating the English summaries of existing events; a date range picker;
presence per tab or per device; showing presence to anyone but admins.

## Decisions

### Presence goes into the audit trail

`ONLINE` and `OFFLINE` join `audit_action`, with entity type `member` and the membership as
entity. One table keeps one feed, one cursor and the actor filter for free, which the
**Сотрудники** tab needs to list someone's actions and their comings and goings together. A
separate presence table would mean merging two paginated sources in the reader.

They carry no client or project, so the existing scope shows them to admins only — the
privacy we want for when colleagues are at their desks — and **Проекты** never lists them.

### Honest times

A departure by silence is noticed by the sweep up to five and a half minutes after the last
request. `PresenceRegistry.sweep` now returns each departure with its last-seen moment, and
`PresenceAnnouncements` receive the moment of each arrival and departure: now for an arrival or
a sign-out, the last request for a lapse. The audit writer takes an optional `occurredAt` that
becomes `created_at`. With the two-minute heartbeat, a closed tab is dated within two minutes of
closing.

The composition writes the events detached from the request, through the audit writer in a
unit of work of their own, so failing to record presence never fails a request or the sweep.
They carry no IP or user agent: most arrivals come through `GET /api/auth/me`, which touches
presence before the request context is set up, and a lapse has no request at all.

### Filters

`inProject=true` adds `project_id IS NOT NULL`; the existing `projectId` narrows to one.
`GET /api/audit/actors` groups the reachable events by `actor_id`, drops null (a deleted
membership), and names each member by their current user name, ordered by name in Russian
collation in the reader. It answers from the same scope as the list, so a select never offers
someone whose events the viewer cannot read.

The projects select uses the projects store the app already loads (`useProjects`), which is
scoped the same way.

### Reading the summaries in Russian

The API writes English summaries from about twenty templates (`Created task “…”`, `Moved task
“…” from IDEA to DONE`, `Set project KPI`, `Published the 2026-09 report`). Rewriting them in
the API would leave every stored event in English, so the window reads them instead:
`describeAuditEvent` in `entities/audit-event` matches the known templates and returns a subject
(«Задача», «KPI проекта»), a name and a detail, translating task columns and months, and the
window falls back to the summary when nothing matches. The nouns are fixed per template, so the
participles agree without guessing anyone's gender. The project an event belongs to comes from
the projects already loaded.

### The window

The tabs are the shared `Tabs`; the selects are the shared `Select`, as on the reports page,
with `all` as the value of **Все проекты** and **Все сотрудники**. Each tab keeps its own
choice in the window's state, so switching tabs does not lose it; the list under each is the
existing infinite list, keyed by its filters.

The list is a timeline grouped by day, not a stack of cards: a line down the left with a dot
per event, the description and the time of day on the first line, the action label, the actor
and the project beneath. The action colours are tokens, `--activity-create`, `-update`,
`-delete`, `-online` and `-offline`, set for both themes; the label is the colour on a 16% tint
of itself. Day headings are not sticky, since the dialog's translucent surface would show
through a heading's background.

## Risks / Trade-offs

- Two events per member per working session add little to the table; the indexes on
  `(org_id, created_at)` serve the reads.
- A member who keeps a tab open is online the whole time, idle or not; presence follows the
  session, not the person at the keyboard.
- A restart of the API forgets who was present: their departure is not recorded, and their next
  request records a new arrival.
