# Running AdPulse — which runner to use

AdPulse can run in several ways. They differ along three axes: **what runs where**
(host vs. container), **foreground vs. background**, and **how fast the frontend hot
reload is**. This guide picks the right one for what you are doing.

## Quick decision

- **Writing frontend code?** → `npm run dev:all` — native Vite HMR is the fastest loop.
- **Writing backend code only?** → `npm run dev` (plus `npm run dev:web` in another
  terminal if you need the UI).
- **Need the app up while you do something else** (demo, integration, poking the API
  from another tool)? → `npm run stack:bg`.
- **Debugging how the services behave together**, or want a reproducible
  container run? → `npm run stack`.
- **First run, or you changed dependencies / a Dockerfile?** → `docker compose up --build`.

## The runners

### `npm run dev:all` — native, fastest frontend loop

Starts Postgres in Docker, then runs the API (`tsx watch`) and the Vite dev server on
the host, side by side with colour-prefixed logs. `Ctrl-C` stops both.

- **Use when:** actively developing — especially the frontend. Native Vite HMR reloads
  in milliseconds with no polling overhead.
- **Avoid when:** you want the stack running detached in the background, or you need
  the API to behave exactly as it does in its container.
- **Needs:** Node and dependencies installed on the host (`npm install`), Docker for
  Postgres.

Single-side variants when you don't need both:

- `npm run dev` — API only (`tsx watch`), Postgres from Compose.
- `npm run dev:web` — web dev server only. It proxies `/api` to `http://localhost:3000`,
  so pair it with a running API.

### `npm run stack` — full stack in containers, foreground

Wraps `docker compose up`: Postgres + API + web, all in containers, logs streamed to
your terminal. `Ctrl-C` stops everything.

- **Use when:** you want to see all three services together, debug cross-service
  behaviour, or run the app the way it runs in CI/production images without installing
  Node tooling on the host. The API container also runs `prisma migrate deploy` on
  startup, so the database comes up migrated.
- **Avoid when:** you are iterating on frontend code and want instant HMR — inside the
  container Vite uses filesystem **polling** (required for bind mounts on macOS), so
  reloads are slower and use more CPU.
- **Needs:** Docker only.

### `npm run stack:bg` — full stack in containers, background

Same as `npm run stack` but detached (`docker compose up -d`). The stack keeps running
after you close the terminal.

- **Use when:** you want the app available in the background — a demo, a long-running
  integration session, or hitting the API from another tool while you work elsewhere.
- **Companion commands:**
  - `docker compose logs -f` — follow the logs.
  - `npm run stack:down` — stop and remove the containers.
- **Avoid when:** you are actively editing and want logs in front of you (use
  `npm run stack` or `npm run dev:all`).

### `docker compose up --build` — first run / after changes

Builds the images before starting. Use it the first time, or after you change
dependencies, a `Dockerfile`, or anything else baked into an image. Add `-d` to build
and then run in the background.

## At a glance

| Runner | Runs where | Mode | Frontend HMR | Best for |
|--------|-----------|------|--------------|----------|
| `npm run dev:all` | API + web on host, DB in Docker | foreground | native, fastest | active development |
| `npm run dev` / `dev:web` | one side on host | foreground | native (web) | working on one side |
| `npm run stack` | all in containers | foreground | polling (slower) | cross-service debugging, parity |
| `npm run stack:bg` | all in containers | background | polling (slower) | demos, integration, background use |
| `docker compose up --build` | all in containers | either (`-d`) | polling (slower) | first run, image/deps changed |

## Ports

- Web dev server: `http://localhost:5173`
- API: `http://localhost:3000`
- Postgres: `localhost:5432`

The web dev server proxies `/api` to the API — at `http://localhost:3000` natively, and
at `http://api:3000` inside Compose (set via `API_PROXY_TARGET`), so the browser only
ever talks to the web origin.

## Tests

Tests don't need a runner:

- `npm run test:web` — frontend tests. They mock the network with MSW, so no Postgres
  and no running services are required.
- `npm test` — API tests. These need Postgres (`docker compose up -d db`) and use the
  separate `adpulse_test` database.
