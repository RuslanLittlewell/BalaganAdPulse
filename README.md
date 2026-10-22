# AdPulse

A media buyer's dashboard. This repository hosts the backend REST API and, alongside
it in the same monorepo, the React frontend.

It runs in production at <https://app.balagan.pro>, on a VPS the CI pipeline deploys to —
see [Deployment](#deployment). Planning lives in [openspec/](openspec/); phases 1–12 are
kept as history in [docs/archive/phases-1-12/](docs/archive/phases-1-12/). CSV import and
AI analysis are deliberately out of scope for now.

## Upgrading an existing checkout

This release adds authentication, and it is **not** a drop-in upgrade for a checkout
that already has data:

- **Wipe the development database.** `Client` gains a non-null `owner_id` with no
  backfill, so the migration fails against a database that already holds clients —
  and the `api` container, which runs `prisma migrate deploy` on startup, then
  crash-loops. Run `docker compose down -v` (this drops the `adpulse_pgdata` volume),
  or `npx prisma migrate reset` inside `apps/api`.
- **Add `JWT_SECRET`** to an existing `apps/api/.env` (and to the root `.env` if you run
  the stack from Compose). The API refuses to start without it, by design — see
  [Authentication](#authentication). `INVITE_CODE` is no longer read: registration now
  redeems an invitation created by an admin.
- **Rebuild the api image _and_ renew its anonymous volumes.** This release adds the
  `jose` dependency, and Compose mounts `/app/node_modules` as an anonymous volume that
  survives recreation — so a rebuilt image alone stays masked by the old volume and the
  container exits with `Cannot find package 'jose'`. Run
  `docker compose up -d --build --renew-anon-volumes api`; the named `adpulse_pgdata`
  volume is left untouched.

## Stack

TypeScript · Express 5 · PostgreSQL 16 · Prisma · Zod · Vitest + Supertest ·
Docker Compose · npm workspaces

## Quick start

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
docker compose up --build
# In another terminal, once migrations finish:
docker compose exec api npm run seed
```

This runs the whole stack — Postgres, the API on `http://localhost:3000`, and the web
app on `http://localhost:5173`. The `api` container runs `prisma migrate deploy` on
startup, so the stack comes up fully migrated with no manual steps. Postgres data lives
in the named volume `adpulse_pgdata` and survives container restarts.

**After changing the Prisma schema, restart the `api` container** — `docker compose restart
api`. It regenerates the Prisma client and applies migrations on start, but a container
that is already running keeps the client it generated last time. Running `prisma generate`
on the host does not help: the container's `node_modules` is its own volume, so a client
generated outside it is not the one it loads. The symptom is a 500 with
`Unknown argument` naming the column you just added. The same is true of a newly installed
dependency, which additionally needs `docker compose up -d --build --renew-anon-volumes`
to reach the container at all.

The seed command is a required first step for a fresh database: it creates the first
administrator, who can then issue invitations. It is idempotent and is safe to run again.

## Running the app

The whole stack (Postgres + API + web) runs from one command. Pick the mode that fits:

| Goal | Command |
|------|---------|
| Foreground, all logs (debug) | `npm run stack` |
| Background (detached) | `npm run stack:bg` |
| Follow background logs | `docker compose logs -f` |
| Stop the background stack | `npm run stack:down` |

These wrap `docker compose up` / `up -d` / `down`. The web container talks to the API
over the Compose network (`API_PROXY_TARGET=http://api:3000`) and enables file-watch
polling so hot reload works across the bind mount on macOS.

For the fastest frontend loop, run the API and web natively (Postgres still from
Compose) — this gives native Vite HMR:

```bash
npm run dev:all
```

`dev:all` starts Postgres (`docker compose up -d db`), then runs the API (`tsx watch`)
and the web dev server side by side with colour-prefixed logs; `Ctrl-C` stops both.
To run a single side on the host instead: `npm run dev` (API) or `npm run dev:web` (web).

See [docs/running.md](docs/running.md) for when to use each runner and the trade-offs.

## Production build

The API serves both `/api` and the built SPA from one process, so a production
build has no separate frontend host and no CORS layer.

```bash
docker build -f apps/api/Dockerfile.prod -t adpulse-api .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=... -e JWT_SECRET=... -e NODE_ENV=production \
  adpulse-api
```

`NODE_ENV=production` makes the server refuse to start on the placeholder secrets
from `.env.example`. Migrations are **not** applied on boot — they run as a separate
step before the running version is replaced, so a failed migration leaves it serving.

The health endpoint is `GET /healthz`.

## Deployment

AdPulse runs on one VPS (`45.87.219.63`) behind <https://app.balagan.pro>. Docker Compose,
from [deploy/compose.prod.yml](deploy/compose.prod.yml), runs the production image — the
API and the built SPA in one process — next to Postgres 16 and MinIO, whose data lives in
Docker volumes on the server. nginx, configured from
[deploy/nginx.conf](deploy/nginx.conf), forwards the domain to the app on
`127.0.0.1:3100`, WebSocket upgrades included. The same process serves the public landing,
<https://bi.balagan.pro>, to requests for that host; see [Landing](#landing).

### How a deploy runs

Pushing to `production` deploys; `main` runs the same checks for pull requests but does
not ship. In [ci.yml](.github/workflows/ci.yml) the `image` job builds the production
image, proves it starts, and on a push publishes it as `ghcr.io/<repository>:<commit sha>`,
an immutable tag. Once the `api`, `web`, `build` and `image` jobs pass, the `Deploy to VPS`
job:

1. signs in to the server as `adpulse-deploy`, checking its host key against
   [deploy/known_hosts](deploy/known_hosts), and copies `compose.prod.yml`, `deploy.sh`
   and `backup.sh` to `/opt/adpulse/`;
2. runs [deploy/deploy.sh](deploy/deploy.sh) with that image, which pulls it, starts
   Postgres and MinIO, takes a backup with [deploy/backup.sh](deploy/backup.sh), creates
   the storage bucket if missing, applies migrations (`prisma migrate deploy` in the
   `migrate` service), replaces the app, waits up to a minute for `/healthz` and, once it
   answers, removes every other app image from the server;
3. checks `https://app.balagan.pro/healthz` from outside.

A failed migration stops the script before the app is replaced, so the previous version
keeps serving. Between the migration and the replacement the old version runs against the
new schema, so migrations must stay backward-compatible with the version already running.
There is no automatic rollback: to return to an earlier version, run on the server
`APP_IMAGE=ghcr.io/<repository>:<earlier sha> /opt/adpulse/deploy.sh`, or revert and push.

The server keeps only the image it is running. Each image is about 1.7 GB, and before
superseded ones were removed they filled the disk, which took down Postgres, MinIO and
nginx at once. So a rollback on the server pulls the earlier image from the registry
again: sign in first with `docker login ghcr.io` using a token that can read packages.
A failed deploy removes nothing, so the version it tried to replace stays on the server.

Backups are gzipped `pg_dump` files in `/opt/adpulse/backups`, one per deploy, kept for
14 days. To take one by hand, run `/opt/adpulse/backup.sh`.

### Configuration and secrets

| What | Where it lives | Who sets it |
|---|---|---|
| Postgres and MinIO credentials, `JWT_SECRET`, `INTEGRATION_ENCRYPTION_KEY`, `GOOGLE_*`, `SEED_ADMIN_*`, `APP_URL`, `SMTP_*`, `TELEGRAM_BOT_TOKEN`, `GROQ_API_KEY` | `/opt/adpulse/.env` on the server, passed whole to the app | Operator, by hand |
| `PRODUCTION_VPS_SSH_KEY` — the private key of `adpulse-deploy` | GitHub Actions repository secret | Operator |
| The server's host key | [deploy/known_hosts](deploy/known_hosts), in the repository | Operator, when the server changes |
| Access to the image registry | The job's own `GITHUB_TOKEN`, used for one deploy and logged out | Nobody |

CI never writes `/opt/adpulse/.env`, and the repository holds no production secret. In
production `APP_URL` is `https://app.balagan.pro`; without it, or without `SMTP_USER` and
`SMTP_PASSWORD`, asking for a password reset link answers 503.

`JWT_SECRET` must be at least 32 characters, and the server refuses to start on the
placeholder from `.env.example` when `NODE_ENV=production`. Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### Changing a secret

Edit `/opt/adpulse/.env` on the server, then re-run the latest `Deploy to VPS` job in
GitHub Actions: it redeploys the same image and the app picks up the new values. Rotating
`JWT_SECRET` invalidates every access token but not the refresh tokens, which are opaque
and stored in the database, so clients recover on their next refresh without signing in
again. To cut off registration instead, revoke the outstanding invitations — there is no
shared code left to rotate.

### Seeding the first admin on the server

A new database needs its first admin once, with `SEED_ADMIN_*` set in `/opt/adpulse/.env`:

```bash
cd /opt/adpulse
APP_IMAGE=ghcr.io/<repository>:<deployed sha> docker compose --env-file .env \
  -f compose.prod.yml run --rm app node --conditions=compiled dist/composition/seed-cli.js
```

See [Seeding the first admin](#seeding-the-first-admin) for what it does.

The platform administrator is seeded the same way, once, with `SEED_PLATFORM_ADMIN_*` set
in the same file:

```bash
cd /opt/adpulse
APP_IMAGE=ghcr.io/<repository>:<deployed sha> docker compose --env-file .env \
  -f compose.prod.yml run --rm app node --conditions=compiled dist/composition/seed-cli.js platform
```

See [The platform administrator](#the-platform-administrator).

### Monitoring

[Beszel](https://beszel.dev) watches the server: CPU, memory, disk, network traffic and each
container, as charts and as alerts. It runs from
[deploy/monitoring/compose.yml](deploy/monitoring/compose.yml) as a Compose project of its
own in `/opt/monitoring`, apart from the app, so a deploy never restarts it. The hub and its
agent take about 30 MB of memory together; the agent reads the Docker socket to report on
containers.

The hub listens on `127.0.0.1` only. Open it through a tunnel, then go to
<http://localhost:8090> and sign in with `BESZEL_USER_EMAIL` and `BESZEL_USER_PASSWORD` from
`/opt/monitoring/.env`:

```bash
ssh -L 8090:127.0.0.1:8090 root@45.87.219.63
```

To install it, or to apply a change to it:

```bash
ssh root@45.87.219.63 install -d -m 700 /opt/monitoring
scp deploy/monitoring/compose.yml deploy/monitoring/setup.sh root@45.87.219.63:/opt/monitoring/
ssh root@45.87.219.63 BESZEL_USER_EMAIL=<email> bash /opt/monitoring/setup.sh
```

The first run writes `/opt/monitoring/.env` with a generated password. Every run starts the
hub, pairs the agent with it over a unix socket, registers the server and sets its alerts, so
a threshold is changed in [deploy/monitoring/setup.sh](deploy/monitoring/setup.sh) and the
script run again:

| Alert | Fires when |
|---|---|
| Disk | usage stays above 80% for 10 minutes |
| Memory | usage stays above 85% for 10 minutes — the server has no swap |
| CPU | usage stays above 85% for 10 minutes |
| LoadAvg5 | the 5-minute load average stays above 2 for 10 minutes — the server has one vCPU |
| Bandwidth | traffic stays above 10 MB/s for 5 minutes |
| ContainerHealth | a container stays unhealthy for 5 minutes |
| Status | the agent stops reporting for 2 minutes |

Alerts reach Telegram. Create a bot with [@BotFather](https://t.me/BotFather), find the chat
id, add `BESZEL_NOTIFY_URL="telegram://<bot token>@telegram?chats=<chat id>"` to
`/opt/monitoring/.env` and run the script again; it sends a test message.

The hub runs on the server it watches, so it cannot report that server going down. An
external check of <https://app.balagan.pro/healthz> covers that.

## Project structure

```
AdPulse/
  package.json              # npm workspaces ["apps/*", "packages/*"]
  docker-compose.yml        # db (Postgres) + api
  docker/postgres/init.sql  # creates the adpulse_test database
  apps/
    api/                    # backend
      prisma.config.ts      # points the Prisma CLI at prisma/, so every command reads all of it
      prisma/schema.prisma  # the generator and the datasource
      prisma/models/        # one file of models and enums per module, named after it
      prisma/migrations/
      src/
        composition/        # the only place adapters are constructed and wired
          app.ts            # builds the Express app (no listen) — used by tests
          server.ts         # entry point
          create-container.ts  # the order modules are wired in, and what the app is given
          wiring/           # one wire… function per module, taking the shared kernel
          create-routes.ts, seed-cli.ts
        modules/            # one directory per business capability
          identity/         # registration, login, tokens, profiles
          members/          # membership, roles, access grants, the session read
          invites/          # role-bearing invitations
          clients/          # clients and the contact book
          projects/         # projects under a client
          campaigns/        # the campaign hierarchy and its measured figures
          audit/            # append-only event writes and scoped activity reads
        shared/             # the deliberately small kernel
          domain/           # AppError
          application/      # ActorContext, Clock, IdGenerator, UnitOfWork
          infrastructure/   # Prisma client, S3, config, clocks, ids
          presentation/     # error handling, rate limiting, request context
      test/                 # Vitest + Supertest
    web/                    # React frontend; permission-gated controls and activity log
  packages/
    access-policy/          # shared role-to-permission matrix used by API and web
  openspec/                 # change proposals, specs, designs and tasks
  docs/archive/             # superseded plans from phases 1-12
```

Request flow: HTTP → a module's presentation adapter (Zod validation) → a use case →
ports → an infrastructure adapter (Prisma, S3) → PostgreSQL. Errors surface as a
transport-independent `AppError` and are mapped to the HTTP envelope in one place.

**How the web app holds what the server sends.** Readings that depend on a period — figures,
ad sets, ads, leads — are React Query queries, refetched when the screen that wants them is
mounted, because a stale figure is worse than a request. The lists the whole session leans on
— the staff and the projects — are zustand stores loaded once and read from everywhere:
`StaffSync` and `ProjectsSync` fill theirs when the app starts. A store is refreshed by the
mutations that change what it holds, so creating or renaming a project reaches every screen
showing the list.

Every client belongs to an organization. The business hierarchy is
`Client → Project → Campaign → Ad set → Ad`, with measured figures stored per day at
each of the last three levels. An active membership
provides the caller's role; `ClientAccess` grants narrow non-admin members to clients or
individual projects. Role permission and row reach are evaluated separately.

### The task board and the calendar

`/tasks` has three views, switched by the **Канбан** / **Календарь** / **Созвоны** tabs in the
page header and faded into place: the board and the calendar show the same work, and the calls
are kept apart in the third. The chosen view is remembered for that person in that
browser, so they return to the one they left; someone else signing in on the same browser
gets their own.

The board is a Kanban of work under a project. Six fixed columns, drawn left to right:
**Идея, В работе, На исправление, На проверке, Готово, Архив**. Cards are dragged between
columns and reordered within one; the move is applied to the board before the server
answers and rolled back if it is refused. Both affected columns are renumbered densely
inside one transaction, so a position is never duplicated or left with a gap.

**A task is closed from its card.** Every card — on the board, in the calendar and in a
project's work in flight — carries a **Готово** checkbox for whoever may change tasks, ticked
exactly while the task is in Готово. Ticking it moves the task to the top of Готово, unticking
it moves it back to the top of В работе, both through the same move a drag makes; on a
repeating task it completes the occurrence instead. The form's header carries **Этап** next to
the priority, listing the six stages; a stage chosen there is applied when the task is saved,
as a move to the top of that stage, and a new task is created in it.

The module can be narrowed by participant and by project at once, both lists naming only what
the board already carries (with **Без участников** and **Без проекта** for the work that has
neither); a participant chosen keeps every task they take part in. Both choices narrow the board
and the calendar alike and are remembered per person in that browser.

A task carries a title, a rich-text description and a priority (`LOW`, `MEDIUM`, `HIGH`,
`URGENT`), and optionally a project, its participants, a due date and a checklist.

**A task has participants, not one responsible member.** Everybody named in **Участники** sees
the task on their board and in their calendar, and a new task starts with the member filling the
form among them. The list is given whole with the task (`participantIds`) and stored in the
`task_participant` join; a member removed from the organization leaves every list. Staff can be
named on any task, and the client's people on a task about a project they reach — they still see
it only when it is marked **Видно клиенту**. Being named grants no right to change a task. The
`assignee_id` column still exists, unread
and unwritten, until a later migration drops it; every former responsible member was carried
over as a participant.

**A task may stand without a project** — the note a media buyer writes to themselves. Such a
task is never shared with a client, because the client comes from the project, and it is
reached by the member who wrote it, its participants and any admin: the
project's grants cannot answer for it. The board and the calendar show it as **Без проекта**.

**The form is composed rather than filled in.** It opens with the title, the description and
the priority, and a row of controls under the title adds what this task actually needs:
**Чек-лист**, **Даты**, **Назначить** — the last carrying the project and the participants
together, because they answer one question. Whatever order the blocks were
added in, they are shown in that order, each separated from the next by a line and carrying
its remove control at its right edge. A block a task already fills is shown from the start and
is not offered again; removing a block clears what it held, so what the form shows and what
the task carries never drift apart. Attachments keep their own place and are not part of the
row, and **Видно клиенту** sits in the dialog's footer, with the controls that act on the task
as a whole.

**The due date is a calendar day**, optionally with a time of day: `due_date` is a `DATE`
and `due_time` a `HH:MM` string, so a task due on 25 September is due on that day for every
reader whatever their machine's clock, and 12:00 is the agency's wall clock rather than an
instant to convert. A time of day without a day is refused, by the use case and by a `CHECK`
constraint both.

A task with a start may also carry the time it ends, `end_time`, on the same day and later than
the start. `24:00` is a valid end — the end of that day — and nothing later is. The form asks
for **Начало** and **Окончание** in two time fields; a browser's time field cannot hold `24:00`,
so `00:00` in **Окончание** stands for midnight and is stored as `24:00`, and an end before the
start is pointed out before anything is sent. Moving the start without naming an end
keeps the task's length, so the calendar's day-and-time reschedule never needs to know the end;
a move that would carry the end past midnight is refused. Clearing the start clears the end.
Wherever the time is shown it reads as a range, `12:00–13:30`.

**A checklist** is a property of the task, like its title: a list of items, each ticked or
not, given whole when the task is created and when it is updated. Adding, ticking and
removing an item changes the form; the change reaches the server when the task is saved, and
closing the dialog drops it. An item is not addressable on its own — `POST /api/tasks` and
`PATCH /api/tasks/:id` carry the whole list, in order, and a `PATCH` naming none leaves the
one the task has. Items ride on the task as it is read, so a board costs one query, and they
go with the task when it is deleted. The card shows the progress as `1/3`.

**A repeating task** carries an interval — `DAILY`, `WEEKLY`, `BIWEEKLY` or `MONTHLY` — and
is completed from its **Готово** checkbox. Completing it moves that same task's due date on by
its interval, counted from its own date rather than from today, keeps its start and end, unticks its
checklist and leaves the card exactly where it sits on the board: completion moves a task in
time, never on the board. No second task is created, so the record of past occurrences lives
in the audit trail. A monthly task due on the 31st falls on the last day of a month too
short to hold it. An interval needs a due date to count from, and clearing the due date of a
task while it repeats is refused.

**A call** is a task with a time of day that repeats, marked with the **Созвон** switch
(`is_call`). The form offers the switch, creating or editing, only once the task has both; a
request marking any other task as a call is refused, and a change that takes the time or the
repetition away quietly ends the call rather than failing. A call is not work on the board: it
leaves **Канбан** and **Календарь** and is found in **Созвоны** alone, described below.

Reading the board follows the same grants as the projects it draws from. Admins and
managers write; guests read; a `CLIENT` member is refused the board entirely, because it
carries the agency's internal notes about a customer's own work.

**Images in a description** are pasted with Ctrl+V, dropped onto the editor, or chosen with the
paperclip beside the attachments, which adds them to the end of the description. They are
uploaded as they land — PNG, JPEG, WebP or GIF, up to 10 MB, recognised by their own bytes
rather than by a file name — and stored as objects; the description keeps only a reference,
so listing a board never carries image data. The editor fetches them with the member's
token and renders them from object URLs, because an `<img src>` pointing at the API would
carry no credentials. An upload whose dialog was cancelled stays recorded with no task, so
it can be found and reclaimed later.

**The calendar** shows one week at a time, Monday to Sunday, with the week named, today
marked and navigation to the previous week, the next one and back to today. It holds only
tasks that have a due date — a task without one is found on the board — and within a day it
puts the timed tasks first, earliest first, then those with no time. A timed task occupies its
time in the hour grid, from its start to its end, or one hour when it has none; an hour is tall
enough at the default scale for a full card, and a card too short for one shows its title and
time on one line. Tasks whose times overlap are laid out side by side, dividing the day's width,
each taking the leftmost place no overlapping card holds, so no card covers another;
back-to-back tasks keep the full width. The grid opens at 06:00 and shows the small hours last,
so midnight is a line inside it rather than its bottom. A line in the primary colour (green in the
light theme, gold in the dark) crosses today's column at the
current time and moves with it.

**Созвоны** is the same week grid holding the calls alone, in whatever stage, each drawn on every
day it recurs, counted from its due date — a daily call on all seven days. The occurrences are
computed in the browser from the due date and the interval, so nothing stores them. A monthly
call falls on its own day each month, or on the last day of a month too short for it. The card
on the due day is the task itself and is dragged to move the call; the others open it on click
and are not dragged, because moving one occurrence would move them all. No call card carries
**Готово**: a call is not finished, it is deleted or switched off.

Dragging a card into another day gives the task that day and starts it where it is dropped,
keeping its length; a drop that would carry the end past midnight is pulled back so the task
ends at midnight. The card moves before the server answers and returns to where it was if the
move is refused. `GET /api/tasks` accepts
`dueFrom` and `dueTo`, though the calendar filters the board it already holds rather than
asking for a week.

The board is not the only place work is visible. A **project** lists the tasks under it
that are still in flight — `IDEA`, `IN_PROGRESS`, `NEEDS_FIX`, `IN_REVIEW`, everything
but the two terminal stages — below its campaigns. Opening one from that list shows it
read-only: the same description renderer the editor uses, with input turned off, and no
control that writes. That screen is for reading; the board is where work is managed.

The task listing accepts `projectId`; it narrows what the caller's grants already allow and
cannot widen it.

The board is shared work, so it updates live. A committed task change is published to
`/api/realtime`, a WebSocket sharing the HTTP server and authenticated by the same HttpOnly
session cookie as the REST API — the browser attaches it to the upgrade request, so no token
is sent by the page or written into a URL. Delivery is decided per event and per connection,
in the order the REST path uses: organization, then the `task.read` verb, then project reach.
A member who cannot reach a task receives nothing about it, which is the socket's equivalent
of the 404 the REST path gives instead of a 403. Entitlement is re-resolved for every event
rather than captured at connect time, so a revoked grant takes effect on the next event
instead of whenever the socket happens to reconnect.

Because other members' changes arrive on their own, the board does not refetch after a move;
the mutation's response is authoritative. A dropped connection is retried with a widening
delay and refetches the board once on reconnecting, which is what covers events published
while it was down — they are not replayed.

The connection registry is in-process, so this is correct for a single API instance. Running
more than one would leave a member connected to instance A unaware of a change committed
through instance B; a shared broker (Postgres `LISTEN/NOTIFY` is the smallest step) is needed
before the board can be trusted across instances. Until then the board still converges on
reconnect and on reload.

### Notifications

Each member has their own notifications, behind the bell in the header: a project's marker
turning green for the current month (**KPI_MET**, at most once per project per month, to the
admins, managers and guests who reach it), a new project (**PROJECT_CREATED**, to the same
people except whoever added it), a new project document (**DOCUMENT_ADDED**, likewise), being
named on a task (**TASK_ASSIGNED**, on creation or when added later, never for naming oneself),
someone else changing a task one is on (**TASK_UPDATED**: an edit, a move to another column, a
repeating task completed; a further change refreshes an unread one and brings it to the top
instead of adding another), and a task's deadline less than a day away (**TASK_DUE_SOON**, to
its participants or, when it names nobody, its creator). A client's person hears about a task
only when the task is shown to the client.

A deadline is the due date at the due time, or at the end of the day without one, read in
`TASK_TIME_ZONE` (`Europe/Minsk` when unset; the API refuses to start with a zone `Intl` does
not know). A worker looks for deadlines on start and every 15 minutes, skips tasks in Готово
and Архив and organizations without the tasks module, and records the deadline it told in
`task.due_soon_for`, so a task is told once per deadline and again when the deadline moves. The KPI check runs on the server when a Meta import for the project finishes and when
its KPI is set, with the project list's arithmetic over the UTC month to date; the month that
was notified is kept in `project.kpi_met_month`. Notifications are created after the change
commits and off the request, so failing to notify never fails the change.

`GET /api/notifications` lists the latest 50 with the unread count; `POST
/api/notifications/:id/read` and `POST /api/notifications/read-all` mark them read. New ones
arrive on `GET /api/notifications/stream`, a Server-Sent Events stream beside the WebSocket,
authenticated by the same cookie: a `ready` event, then one `notification` event per
notification, and a keepalive comment every 25 seconds inside nginx's read timeout. The stream
sends `X-Accel-Buffering: no` so nginx passes it through unbuffered. The browser reconnects it
on its own and the web app refetches the list on every reconnection; when the browser gives up,
as on an expired session, the app renews the session and reopens it with a widening delay. Each
notification that arrives on the stream plays `shared/assets/notification.wav` once per browser:
the tabs claim it through `localStorage`, the visible one first, and a browser that refuses
sound before the first click on the page is simply not heard. Like
the WebSocket registry, the subscribers live in the API process, and shutting down ends every
open stream before the server closes.

### The Telegram bot

Admins and managers can put a task on the board by sending a voice or text message to a
Telegram bot. It is on when the API has both `TELEGRAM_BOT_TOKEN` (from
[@BotFather](https://t.me/BotFather)) and `GROQ_API_KEY` (from
[console.groq.com](https://console.groq.com/keys)); with either missing, the profile does not
offer it and nothing is polled. `GROQ_TRANSCRIPTION_MODEL` (`whisper-large-v3-turbo`) and
`GROQ_TASK_MODEL` (`openai/gpt-oss-20b`) override the models; the task model must support
Groq's strict structured outputs.

Groq refuses requests from Belarus with `403 Forbidden`, so production reaches it through a
relay on a server elsewhere: `GROQ_BASE_URL` replaces `https://api.groq.com/openai/v1` with the
relay's address, which must be https since the API key travels with every request. The relay
is a plain reverse proxy to `api.groq.com` that admits only the production server's address
(`203.0.113.10` below),
for example with Caddy:

```caddyfile
groq-relay.example.com {
	@others not remote_ip 203.0.113.10
	respond @others 403
	request_body {
		max_size 26MB
	}
	reverse_proxy https://api.groq.com {
		header_up Host api.groq.com
	}
}
```

Routing around the block goes against Groq's terms, and the key may be shut off for it.

A member links their Telegram from **Настройки профиля**: **Подключить** issues a one-time
link to the bot (`POST /api/telegram/link`), valid for 15 minutes; pressing Start in the bot
sends it the token and ties the chat to the member. `GET /api/telegram` tells the profile
whether the bot is offered and linked, and `DELETE /api/telegram/link` unlinks. The bot is
offered to active admins and managers of an active organization with the tasks module, and
that is checked again at every message, so a suspension takes effect at once.

A voice message of up to two minutes is transcribed by Groq's Whisper in Russian; a text
message is taken as it is. A Groq language model then reads it into a draft, given today's
date in `TASK_TIME_ZONE`, the projects the member reaches and the organization's active staff,
and answers by keys, so the draft can name only those. Whoever sends the message is always one
of the task's participants. The bot shows the draft with
**Создать** and **Отмена**: **Создать** creates the task as the member through the task use
cases, with its audit entry, live board update and notifications, and links to it under
`APP_URL`. Drafts are kept for a day in `telegram_task_draft` and used once.

The bot receives updates by long polling from the API process, so it needs no public address
or webhook. Telegram allows one poller per bot token: give local development its own bot, or
the production one and the laptop will take each other's messages. Voice recordings, message
text and the names of the member's projects and colleagues are sent to Groq.

Business mutations append an `AuditEvent` in the same database transaction as the
change. Events retain the actor's name, email and role as they were at write time and are
read through a scoped, cursor-paginated endpoint. Members coming online and going offline are
recorded too, as `ONLINE` and `OFFLINE` events with the member as entity: online at their first
request after being away, offline when they sign out, or dated at their last request when five
minutes pass without another. They concern no client or project, so only admins read them.

The history window in the app header has two tabs. **Проекты** lists the events tied to a
project (`GET /api/audit?inProject=true`) with a select of the viewer's projects;
**Сотрудники** lists everything the viewer may read with a select of the people in it
(`GET /api/audit/actors`), coming online and going offline among their actions. The list is a
timeline by day with an action colour per event; the window reads the API's English summaries
into Russian (`describeAuditEvent`) and shows any it does not know as recorded.

## API

Base prefix `/api`. Requests and responses are JSON.

The surface below is published by the API itself. **`GET /api/docs`** renders it for
reading and for trying requests against the running server, and `GET /api/openapi.json`
is the same description as an OpenAPI 3.1 document. Both answer without a session. Request
bodies and query parameters in it are converted from the Zod schemas the endpoints
validate with, and a test compares the description against the routers Express actually
mounts, so neither can drift from the other. `API_DOCS=off` withdraws both.

### API architecture

The API uses a module-first Clean/Hexagonal Architecture. Business modules live under
`apps/api/src/modules/<module>` and expose their intentional application contracts only
through the module's `index.ts`. Each module may contain `domain`, `application`,
`infrastructure`, and `presentation` layers. Runtime assembly belongs exclusively to
`apps/api/src/composition`; reusable cross-module concepts belong in the deliberately
small `apps/api/src/shared` kernel.

The kernel and the modules are reached through the `#shared/*` and `#modules/*` subpath
imports rather than a chain of `../`: they map to `src/shared/` and `src/modules/` for
`tsx` and Vitest, and the `compiled` condition points the built server at `dist/`, which
is why `npm start` and the production image run `node --conditions=compiled`. A relative
import climbs at most one directory and stays inside its own module; anything further, or
in another module, goes through an alias. The architecture test resolves both forms to
enforce the rules below.

Dependencies point inward: presentation and infrastructure may depend on application,
and application may depend on domain. Domain and application code do not import Express,
Zod, Prisma, S3 adapters, or process globals. Presentation does not import persistence,
infrastructure does not import HTTP presentation, and modules never deep-import another
module. Concrete adapters are constructed only in the composition root. An architecture test
enforces these rules, and enforces that nothing lives outside `modules/`, `shared/` and
`composition/` — the migration's legacy allow-list is now empty and stays that way.

A new module follows this template:

```text
modules/<module>/
  domain/                 # invariants and framework-free types
  application/
    ports.ts              # use-case-shaped dependency contracts
    <module>-use-cases.ts # orchestration and transaction boundaries
  infrastructure/         # Prisma, storage, crypto and other adapters
  presentation/http/      # Express handlers and Zod schemas
  index.ts                # public application surface
```

**Transactions.** A mutation that must be atomic runs inside `unitOfWork.run`, which
hands ports an opaque `TransactionContext`. Adapters exchange it for a Prisma transaction
client; application code never sees one. Audit events are appended through that same
context, so the trail and the data it describes commit or roll back together.

**Reach and role.** Which rows a member can see is translated inside each module's Prisma
adapter, from the actor's role and grants into a query filter. Which verbs their role
permits comes from `packages/access-policy`. Reach is checked first: a record the caller
cannot reach answers 404 rather than 403, so a refusal never reveals that it exists.

Use cases receive dependencies explicitly through factories. Persistence ports accept an
opaque transaction context when a mutation must be atomic; Prisma transaction clients do
not cross into application code. HTTP characterization tests protect existing routes,
payloads, statuses and authorization behavior while pure application tests use in-memory
ports, fixed clocks and deterministic identifiers.

| Method | Path | Description | Success |
|--------|------|-------------|:---:|
| POST | `/auth/register` | Register behind an invite code, returns both tokens | 201 |
| POST | `/auth/login` | Sign in, returns both tokens | 200 |
| POST | `/auth/refresh` | Exchange a refresh token for a new access token | 200 |
| POST | `/auth/logout` | Delete the refresh token | 204 |
| POST | `/clients` | Create a client | 201 |
| GET | `/clients` | List clients | 200 |
| GET | `/clients/:id` | Single client | 200 |
| PATCH | `/clients/:id` | Partial update | 200 |
| DELETE | `/clients/:id` | Delete | 204 |
| GET | `/tasks` | The board, ordered by column then position; `?projectId=` narrows it | 200 |
| POST | `/tasks` | Create a task | 201 |
| GET | `/tasks/:id` | Single task | 200 |
| PATCH | `/tasks/:id` | Partial update | 200 |
| POST | `/tasks/:id/move` | Where a drag landed: `{ column, position }` | 200 |
| DELETE | `/tasks/:id` | Delete, with its images | 204 |
| POST | `/task-images` | Upload one image pasted or dropped into a description | 201 |
| GET | `/task-images/:id` | The bytes, to whoever may read the task | 200 |
| GET | `/projects/:id/campaigns` | A project's campaigns, each with its figures | 200 |
| GET | `/projects/:id/summary` | The project's figures, summed | 200 |
| GET | `/projects/:id/daily` | The project's measured days | 200 |
| GET | `/campaigns/:id` | One campaign with its figures | 200 |
| GET | `/campaigns/:id/ad-sets` | Its ad sets, each with its figures | 200 |
| GET | `/campaigns/:id/daily` | Its measured days, unsummed | 200 |
| GET | `/ad-sets/:id/ads` | An ad set's ads, each with its figures | 200 |
| GET | `/summary` | Every project the caller reaches, summed | 200 |
| GET | `/summary/channels` | The same, split by channel | 200 |
| GET | `/summary/projects` | Each project the caller reaches, with its KPI, figures and measured days | 200 |

Every reading above is scoped to a range: `?from=YYYY-MM-DD&to=YYYY-MM-DD`, both
endpoints included and both required.

`name` is required on create; `email` is optional.
Errors are normalized to a single shape:

```json
{ "error": { "message": "...", "details": [] } }
```

### Figures

Six figures are **measured** and stored, one row per entity per day: spend, impressions,
reach, clicks, conversions and revenue. Six ratios are **derived** on read and never
stored: CTR, CPC, CPM, CPA, ROAS and frequency.

A stored ratio would be a second source of truth for something already recorded, and the
two drift the moment a figure is corrected. It also cannot be re-summed: a week's CTR is
the week's clicks over the week's impressions, not the average of seven daily CTRs. A
ratio whose divisor is zero is reported as `null` — a campaign that spent money and got
no clicks has no cost per click, and `0` would read as free.

Ad platforms restate a day as attribution settles, so the key is `(entity, date)` and a
repeat replaces rather than appends. Each level stores what the platform reports *for that
level*: a campaign is never summed from its ads, because reach is deduplicated across the
campaign's audience. A project and the organization **are** summed from campaigns —
those are our own groupings and the platform has no opinion about them.

The dashboard's project table reads `/summary/projects` once rather than a summary and a
series per project, so opening it costs the same request whether the agency runs three
projects or thirty. Every summary reads the days of all the campaigns it sums in one
query and groups them in memory, so none costs a query per campaign either. A project
with nothing measured is still listed, at zero with no days.

The project list reads the same `/summary/projects` for the period in the address and paints
each project's marker from its own KPI, in the campaign indicator's zones: green from 100%,
yellow from 80%, red below it, grey without a KPI or a measured figure. The percentage is
the one the project's KPI tile shows, so the two never disagree.

The dashboard also reads `/summary/projects` for the current month, from its first day to
today, whatever period it shows, and gauges how the projects stand against their KPIs: a
semicircle split by project count into green (100% and up), red (below 100%, the marker's
yellow zone included) and grey (no KPI, or no figure to measure it by), with a needle at the
green share. Beside it, the Важная информация panel lists the projects with no KPI at all, each linking
to its project page with the dashboard's period; a KPI whose figure is unmeasured is grey on
the gauge but not warned about.

A project's KPI can also be set by hand — **Вручную** in its KPI dialog — for a goal the
platform does not measure: `{ "metric": "MANUAL", "name", "value", "target" }` on
`PUT /projects/:id/kpi`. Its progress is the value over the target, whatever the period,
and the value changes only when someone edits it. Campaigns and the organization refuse it
with 400, and it never stands in for a campaign without a KPI of its own.

Nothing writes these figures yet. This change defines the shape they land in and reads
what is there; a later change connects the platforms.

Validation failures return 400 (including a range that ends before it starts), anything
the caller cannot reach returns 404, and anything unexpected returns 500.

## Authentication

The four `/api/auth/*` endpoints above are open. **Everything else under `/api` requires
an `Authorization: Bearer <accessToken>` header** — the guard is mounted on the whole
prefix, so a route added later is protected by default.

An access token is a JWT valid for 15 minutes; a refresh token is an opaque 30-day value
stored server-side as a `sha256` digest. `POST /auth/refresh` renews the access token,
and `POST /auth/logout` deletes the refresh token so it stops working.

One environment variable is required, and the API refuses to start without it:

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Signs and verifies access tokens (HS256) |

In production, startup additionally rejects the `.env.example` placeholder and a
`JWT_SECRET` shorter than 32 characters.

A member who forgot their password asks for a link at `POST /auth/password-reset`; the
answer is 202 whether or not an account uses the email, and only an existing account is
mailed. The link carries a random token stored as a `sha256` digest; it works once, for
one hour, and asking again replaces it. `POST /auth/password-reset/{token}` sets the new
password, deletes every refresh token of the account and signs in. Mail goes over SMTP:

| Variable | Purpose |
|----------|---------|
| `APP_URL` | Public address the link is built on; defaults to `http://localhost:5173` outside production |
| `SMTP_USER`, `SMTP_PASSWORD` | SMTP account; for Gmail, an app password rather than the account's own |
| `SMTP_HOST`, `SMTP_PORT` | Server, defaulting to `smtp.gmail.com` and 465 with TLS; any other port uses STARTTLS |
| `MAIL_FROM` | Sender, defaulting to `Balagan BI <SMTP_USER>` |

Without `SMTP_USER` and `SMTP_PASSWORD`, development writes the message, link included, to
the API's log. In production, without them or without `APP_URL`, asking for a link
answers **503**.

### Roles and membership

A user is an identity — a name, an email, and optionally a phone and a Telegram handle
they keep current themselves in profile settings. What they may do comes from their
**membership** in the organization, which carries exactly one role — `ADMIN`, `MANAGER`, `GUEST` or `CLIENT`.
The membership is read from the database on every request rather than sealed into the
access token, so a suspension or a demotion takes effect on the very next call instead of
when the token expires. A user with no membership, or a suspended one, is refused with
**403**.

The role decides which verbs are allowed; which rows a member can reach is a separate
question. Both are enforced, and the verb half lives in `packages/access-policy`, imported
by the API and the web app so the interface cannot offer what the API refuses.

- `ADMIN` reaches the whole organization and manages members, invitations and destructive
  operations.
- `MANAGER` works only in granted clients/projects and may create and edit business data.
- `GUEST` has read-only access to granted clients/projects.
- `CLIENT` has read-only access to the client named by their grant, and may raise a task.
- `CLIENT_ADMIN` is the principal on a customer's own company: it reaches exactly what a
  `CLIENT` reaches, and additionally administers that company's people — invites them,
  sees the invitations outstanding, revokes one, removes somebody who joined. It writes
  nothing the agency owns.

Which side a role is on is asked through `isCustomer` rather than compared by name, so a
customer role added later is treated as one everywhere at once — in what it sees on the
board, in what a task it raises is marked with, and in its exclusion from the agency's
own staff listing.

All four roles may read audit history, but the same grants constrain which events they see.

### Registration

Registration is by invitation, and by nothing else: the invitation link is the only way
in, and no screen asks anybody to type a code. The invitation carries its own type, and
`GET /api/regustration/:code` answers it publicly — so `/regustration/:code` shows the
form the code calls for, and nothing else about the agency. An unknown, revoked, used or
expired code gives one answer for all four.

An **employee** gives a name, an email, a password and its confirmation, plus an avatar to
upload or generate. The invitation already decided their role and which projects it
grants.

Somebody **joining a company that already exists** fills the same fields and is asked
nothing about a company: the invitation named it. They become an ordinary `CLIENT` of that
client and reach its projects. Such an invitation is issued by either side — the client's
own principal, for their own company alone, or an agency admin for any client. A principal
naming somebody else's client is told it does not exist, so it cannot count the agency's
other customers.

A **client** fills two steps: their own account — the contact's fields, a password, an
avatar — and then the first project they create, with its monthly budget in `BYN`, `RUB`,
`USD` or `EUR`. A budget always carries the currency it is stated in; a project with no
amount still has one, so entering an amount later is a one-field decision. What a campaign
*spent* is a different figure and keeps its own formatting. The account, the client record, the
project and the grant over it are written in one transaction: either all of it lands or
none of it does and the link still works. Both steps stay mounted, so stepping back loses
nothing.

### What each role sees on the board

Reach decides which projects a member may look at. Whose work it is decides what they see
inside them, and can only narrow it further:

- `ADMIN` — every task in the organization.
- `MANAGER`, `GUEST` — only the tasks they take part in, and the tasks nobody takes part in
  that they created. Any other task nobody takes part in is on the admin's board alone, which
  is the point: a client's request waits there until an admin reads it and names somebody.
- `CLIENT` — only the tasks marked as shown to them.

A task raised by a client is marked shown to them when it is created; anything the agency
raises is its own. **Only an admin changes that mark** — a manager may create, edit and
complete a task, but what a customer is shown is one decision made in one place. The same
rule filters the WebSocket, so an event never delivers what a listing would not.

A customer's contact book is their own company's people — name, email, phone, Telegram
and who among them is the principal. The agency's client card is the company's contact
details alone. The employee directory is the agency's own staff, and a customer is not
offered it at all. Both lists show how to reach somebody, with a dash where a detail was
never given.

The web app has no screen for agency member administration. The contact book's employee pane
lists the organization's members with their name, email and role, read-only, and is where
invitations are issued; changing a role, suspending a member or removing one is done
through the member endpoints. The rules are unchanged and enforced server-side either
way — only an admin may make those changes, no admin may remove their own membership, and
the last admin cannot be removed.

### Seeding the first admin

Registration requires an invitation, and only an admin can issue one — so a brand-new
database has to be seeded once before anybody can get in at all:

```bash
SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD=... npm run seed -w apps/api
```

It reads `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` and optionally
`ORG_NAME` (which renames the migrated bootstrap organization). Running it again does
nothing once an active admin exists, so a deploy
pipeline can call it unconditionally. A database that already held accounts needs no
seeding: the tenancy migration made its oldest account the admin.

### The platform administrator

One instance serves many organizations. The platform administrator belongs to none of
them: they sign in on the same login page, land in a separate area whose one module lists
every organization, and reach nothing inside any organization. Seed the account once:

```bash
SEED_PLATFORM_ADMIN_EMAIL=you@example.com SEED_PLATFORM_ADMIN_PASSWORD=... npm run seed:platform -w apps/api
```

The password must be at least eight characters. Running it again does nothing once a
platform administrator exists, and it never changes an existing account's password; an
address that already has an account without a membership is made the administrator, one
that belongs to an organization is refused.

Adding an organization takes its name, the optional modules it is entitled to and the
email of its first administrator. Dashboard and Projects are always enabled; CRM, Tasks
and Reports are optional, and a disabled one is absent from the organization's navigation
while its endpoints answer 404. The organization is created with an admin invitation bound
to that email, whose registration link the platform administrator hands over. An
organization can later be renamed, given or relieved of modules — a removed module's data
is kept and returns with it — and suspended: every request by its members is then refused
with 403 until it is reactivated, and nothing it holds is deleted.

### Invitations

An admin creates an invitation, choosing the role it will grant, and passes on its code;
`POST /api/auth/register` redeems it and creates the account and its membership together.
An invitation is single use, may carry an expiry, may be bound to one email address, and
can be revoked while it is still pending.

Every rejected invitation — unknown, expired, revoked, already redeemed, addressed to
somebody else — answers with the same status and the same message, so registration cannot
be used to discover which codes exist or who was invited.

**401 versus 403 versus 404.** A missing, malformed or expired token gives **401** — the
request never reaches a service. An authenticated caller who is not an active member, or
whose role does not permit the verb, gives **403**. A resource that exists but is out of
the caller's reach gives **404**, never 403: someone else's id is indistinguishable from
an id that does not exist, so ids cannot be probed.

## Commands

Run from the repository root:

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the API in watch mode |
| `npm test` | Run the test suite |
| `npm run build` | Compile TypeScript to `dist/` |

Inside `apps/api` there are also `prisma:migrate`, `prisma:generate` and
`db:test:deploy`.

## Testing

Tests need a running Postgres and the S3-compatible storage the avatar and task-image
routes write to — `docker compose up -d db storage-init` starts both and creates the
bucket. They use a separate `adpulse_test` database so clearing data never touches
development data; the `pretest` script applies migrations to it automatically.

```bash
docker compose up -d db storage-init
npm test
```

## Documentation

- [CONTRIBUTING.md](CONTRIBUTING.md) — commit conventions and development workflow
- [docs/running.md](docs/running.md) — which runner to use when
- [openspec/](openspec/) — the planning workflow: one directory per change, holding its
  proposal, capability specs, design and tasks
- [openspec/specs/](openspec/specs/) — the current behaviour contract, per capability
- [docs/archive/phases-1-12/](docs/archive/phases-1-12/) — the specs and plans of phases
  1-12, kept as history and no longer the workflow

## Meta advertising accounts

Projects can connect a Meta account by entering Account ID and a token in the web
interface. See [Meta integration](docs/meta-integration.md) for manual refresh,
daily imports and the required server encryption key.

## Google Ads accounts

Projects can connect a Google Ads account by signing in with Google in the web
interface; each project signs in on its own. See
[Google Ads integration](docs/google-ads-integration.md) for the sign-in, what is
imported and the server configuration it needs.

## Landing

The public site of BalaganBI lives in [apps/landing](apps/landing): Astro with Tailwind,
rendered at build time into static HTML, so its text is in the document as served — Google's
OAuth review reads it there. It wears the web app's palette, light or dark after the visitor's
system, and the same animated waves.

| Page | Path |
|---|---|
| Home: what BalaganBI does, its modules, connecting ad accounts, Google data use | `/` |
| Privacy policy, Russian and English | `/privacy` |
| Not found | `404.html` |

```bash
npm run dev:landing     # http://localhost:4321, reloads on save
npm run build:landing   # apps/landing/dist
npm run test:landing    # builds, then checks the pages carry what Google reads
```

The production image builds the landing next to the web app, and the API process answers
requests for `LANDING_HOST` (default `bi.balagan.pro`; empty turns it off) from its build. Any
other host gets the API and the web app as before. A path the landing does not have answers
its 404 page, `/api` included.

Putting it live once, on the server and at the registrar:

0. Copy [deploy/security-headers.conf](deploy/security-headers.conf) to
   `/etc/nginx/snippets/security-headers.conf` (the `bi.balagan.pro` block includes it: HSTS, frame, COOP,
   nosniff, referrer and permissions policies, and a report-only CSP). After `certbot`, check the
   HTTPS block still includes it: `curl -sI https://bi.balagan.pro/`.
1. At hoster.by add an `A` record `bi` → `45.87.219.63`.
2. Copy the `bi.balagan.pro` server from [deploy/nginx.conf](deploy/nginx.conf) into the
   server's nginx configuration, then `nginx -t && systemctl reload nginx`.
3. Issue its certificate: `certbot --nginx -d bi.balagan.pro`.
4. In Google Cloud, Branding: home page `https://bi.balagan.pro`, privacy policy
   `https://bi.balagan.pro/privacy`.
