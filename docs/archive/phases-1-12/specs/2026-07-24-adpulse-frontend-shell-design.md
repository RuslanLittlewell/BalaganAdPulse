# AdPulse Frontend — Design (Phase 3: application shell and clients)

**Date:** 2026-07-24
**Status:** approved

> Shared context and conventions: [conventions.md](../conventions.md).

## Context

Phases 1 and 2 delivered the backend: client CRUD, campaigns, per-campaign
properties, daily records and computed metrics (see
[2026-07-20-adpulse-backend-clients-design.md](2026-07-20-adpulse-backend-clients-design.md)
and
[2026-07-21-adpulse-campaigns-design.md](2026-07-21-adpulse-campaigns-design.md)).
The API has no consumer yet.

Phase 3 creates `apps/web` and delivers the outer frame of the product: a fixed left
sidebar listing clients, a dialog for creating and editing them, and a main area that
shows an empty state until a client is selected.

The visual language is taken from reference screenshots of an existing tool: a dark
canvas, an orange accent, condensed uppercase monospace labels. That styling is
provisional and will be redesigned. The design therefore optimises for one property
above all — **a redesign must be a change inside components, not a rewrite of
screens.**

## Scope

**In scope:** the `apps/web` workspace, the application shell (sidebar plus main
area), the client list, the create/edit client dialog, client deletion, the empty
state, the design-token layer and the first reusable components.

**Out of scope:** the report-sheet switcher, the daily statistics grid, KPI tiles, the
period filter, CSV import, AI tabs, authentication, billing and the light theme.
Controls belonging to those features are not rendered at all — not rendered disabled.
The token layer is arranged so a light theme is later a single additional block, but
no light theme ships in this phase.

## Architecture

### Workspace

`apps/web` joins the existing npm workspaces (`apps/*`). Stack:

| Concern | Choice |
|---------|--------|
| Build | Vite |
| UI | React + TypeScript |
| Routing | react-router |
| Server state | TanStack Query |
| Styling | CSS Modules + CSS custom properties |
| Tests | Vitest + Testing Library + MSW |

No utility-CSS framework and no third-party component kit. Every component is written
in this repository, because the component layer is itself a deliverable: the project
accumulates a library it owns, and the coming redesign edits that library rather than
replacing a dependency.

Vite proxies `/api` to `http://localhost:3000`, so the browser makes same-origin
requests and the API needs no CORS configuration. The root `package.json` gains
`dev:web`, `test:web` and `build:web`.

### Layers

```
src/
  components/          reusable UI — props only, no API and no domain vocabulary
  features/clients/    client feature — API calls, queries, composed views
  lib/                 http client, query client
  i18n/                copy dictionary
  styles/              tokens and reset
  routes/              route components
```

The rule that keeps the library reusable: nothing in `components/` may import from
`features/`, and no component there names a domain concept. `ListItem` knows about a
selected row; it does not know about clients. Violating this is what turns a component
library back into page markup.

### Screen areas

```
AppShell                    grid 280px | 1fr, height 100vh
├─ Sidebar                  own scroll container
│  ├─ BrandHeader           wordmark and byline, bottom border
│  ├─ SectionLabel          "CLIENTS"
│  ├─ ClientList            scrolls, takes the free vertical space
│  │  └─ ClientListItem     Avatar + name, selected state
│  ├─ NewClientButton       dashed outline, pinned below the list
│  └─ footer slot           optional; nothing rendered into it in this phase
└─ MainArea
   ├─ ClientHeader          Avatar + name + actions slot; only with a client selected
   └─ <Outlet>              route content — EmptyState in this phase
```

`AppShell` takes `sidebar` and `children` and knows nothing about clients. The sidebar
scrolls independently of the main area, so a long client list never moves the content.

`Sidebar` exposes an optional `footer` prop for the account, plan and theme controls of
later phases. This phase passes nothing, so no footer strip renders — the slot exists
in the component, not as empty markup on the page.

`ClientHeader` fills its actions slot with **Edit** and **Delete**, the two operations
this phase supports. Both open a `Dialog`.

## Components

The first entries in the library. Each is a directory holding `Component.tsx` and
`Component.module.css`.

| Component | Responsibility | Notable props |
|-----------|----------------|---------------|
| `AppShell` | Two-column grid | `sidebar`, `children` |
| `Button` | All buttons | `variant: primary \| ghost \| dashed \| danger`, `size` |
| `Dialog` | Modal built on native `<dialog>` | `open`, `onClose`, `title`, `children` |
| `TextField` | Label, input, error text | `label`, `error`, input props |
| `Avatar` | Square tile with an initial | `name`, `size` |
| `SectionLabel` | Uppercase monospace caption | `children` |
| `ListItem` | Selectable list row | `selected`, `leading`, `children`, `onClick` |
| `EmptyState` | Icon, heading, description | `icon`, `title`, `description` |

`Dialog` uses the native element for focus trapping, `Esc` handling and the top-layer
backdrop, rather than reimplementing them.

`Avatar` derives its background from a hash of the name, picking from a short palette
declared in the token file (`--color-avatar-1` … `--color-avatar-5`, the accent among
them). Clients stay visually distinguishable without storing a colour, and the palette
stays under the redesign's control.

Feature components in `features/clients/`:

- `ClientSidebar` — assembles `ClientList` from `ListItem` and `Avatar`, wires
  selection to the router
- `ClientFormDialog` — one dialog serving both create and edit, driven by an optional
  `client` prop

## Design tokens

`styles/tokens.css` defines custom properties on `:root`; components reference only
`var(--…)` and never literal colours. A redesign then edits one file.

| Token | Value | Use |
|-------|-------|-----|
| `--color-bg` | `#111112` | Page canvas |
| `--color-surface` | `#1A1A1C` | Sidebar, dialog, raised panels |
| `--color-border` | `#262628` | Dividers and outlines |
| `--color-accent` | `#E8703A` | Primary actions, selection, avatars |
| `--color-text` | `#F5F5F5` | Primary text |
| `--color-text-muted` | `#8A8A8E` | Captions and labels |

Spacing runs on a 4px scale (`--space-1` … `--space-8`), radii are `--radius-sm` 8px
and `--radius-md` 12px. Two families: `--font-sans` for content and `--font-mono` for
uppercase labels, which carry letter-spacing.

## Data flow

TanStack Query owns all server state; no client-side store is introduced. The selected
client lives in the URL (`/clients/:clientId`), which makes the selection shareable and
survives a reload.

| Hook | Endpoint | Invalidates |
|------|----------|-------------|
| `useClients` | `GET /api/clients` | — |
| `useCreateClient` | `POST /api/clients` | `['clients']` |
| `useUpdateClient` | `PATCH /api/clients/:id` | `['clients']` |
| `useDeleteClient` | `DELETE /api/clients/:id` | `['clients']` |

`lib/http.ts` wraps `fetch`: it prefixes `/api`, sets JSON headers, and on a non-2xx
response parses the API's `{ error: { message, details } }` envelope into a thrown
`ApiError` carrying `message`, `details` and `status`. Components read
`error.message`; field-level `details` feed `TextField` errors in the dialog.

The client form mirrors the API contract: `name` is required, `niche`, `monthlyBudget`
and `email` are optional. The `monthlyBudget` field is asymmetric — the create/update
schema accepts it as a JSON **number**, while a response serialises the Prisma
`Decimal` back as a **string**. The form therefore holds a text value, converts a
non-empty entry to a number for the request body (and omits the key when the field is
blank), and reads the string straight from the response when prefilling the edit form.

The client rows in the sidebar show the name alone. The reference screenshot places a
day count beneath it, but `GET /clients` returns plain client rows, and fetching every
client's campaigns and records to render a caption is a bad trade. A count arrives
when the API can supply it.

## Copy

All interface text is English, held in `i18n/en.ts` as a flat key-value map and read
through a `t(key)` helper — not inlined in JSX. No i18n library: adding a second
language later means one more dictionary file and a provider, and the extraction work
is already done. This also keeps the repository's English-only rule intact while
leaving translation open.

## States and errors

Each data-driven area has three states, and each is a component, not an inline
ternary:

- **Loading** — the sidebar shows skeleton rows; the client list is never blank
  mid-fetch
- **Error** — a message in place of the list with a retry button
- **Empty** — no clients yet: a prompt above the "New client" button; no client
  selected: `EmptyState` in the main area

Deleting a client asks for confirmation in a `Dialog` and, on success, navigates back
to `/`. A request to `/clients/:clientId` for an unknown id renders a not-found
`EmptyState` rather than an error screen — the id may simply be stale.

## Testing

Vitest with Testing Library and MSW ([shared testing setup](../conventions.md)). MSW
intercepts `/api` requests, so tests need no running backend and no database.

| Level | Covers |
|-------|--------|
| Component | Each library component in isolation: variants, selected state, dialog open/close, error rendering |
| Feature | Client list renders from mocked data; creating a client sends the right body and refreshes the list; validation errors reach the fields; delete confirms and navigates |
| Shell | Routing between `/` and `/clients/:id`; empty, loading and error states |

Queries in tests run through a fresh `QueryClient` with retries disabled, so a failing
request fails the assertion instead of the timeout.
