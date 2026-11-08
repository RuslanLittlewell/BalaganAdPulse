## Why

The tiles a period summary shows are kept in each person's browser, so two people looking
at the same project see different figures, a manager who sets up a client's project has
set it up for nobody but themselves, and a member who signs in on another device starts
over. A project's summary is part of how the agency reads that project; it should read the
same for everyone who opens it, and a member's own dashboard should follow them.

## What Changes

- A project carries its own choice of summary tiles, stored on the server and shown to
  everyone who opens the project page, and to everyone who opens one of its campaigns.
  Only admins and managers change it; guests and customers see it with no placeholder.
- A member's dashboard tiles are stored on the server against their membership, so they
  follow the member to any browser and stay their own.
- The browser keeps no summary tiles any more: nothing is read from or written to its
  storage for them.
- Each member's dashboard and each existing project start with Лиды alone; a project
  created from now on starts with no tile.
- New `GET`/`PUT /api/projects/:id/summary-tiles` and `GET`/`PUT /api/dashboard/summary-tiles`,
  at most five tiles from the catalogue.
- **BREAKING** (UI only): every choice made in a browser is dropped, for the dashboard and
  the project page alike; everyone chooses their tiles again.

## Capabilities

### New Capabilities

### Modified Capabilities
- `summary-tiles`: the project page's tiles belong to the project and are shared by
  everyone, changed by staff only; the dashboard's belong to the member and are kept on
  the server.

## Impact

- Prisma: a `summary_tile` enum, `project.summary_tiles` and `membership.dashboard_tiles`,
  with migrations; existing rows get Лиды.
- `apps/api/src/modules/summary-tiles`: a new module with both owners' routes, wired in
  composition and documented in OpenAPI. `packages/access-policy`: who may change a
  project's tiles.
- `apps/web/src/entities/summary-tiles`: the catalogue, the calls and the queries.
  `apps/web/src/widgets/agency-overview`: the summary takes its tiles from its caller; its
  browser store is removed. Dashboard, project and campaign pages read the server.
