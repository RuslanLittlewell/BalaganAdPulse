# Frontend Feature-Sliced Design

## Goal

Reorganize `apps/web/src` around Feature-Sliced Design without changing runtime behavior.

## Layers

- `app`: application bootstrap, providers, and routing.
- `pages`: route-level composition.
- `widgets`: large reusable page sections.
- `features`: user actions and application capabilities.
- `entities`: domain data, queries, and entity-focused UI.
- `shared`: reusable UI, libraries, configuration, styles, and test infrastructure.

Dependencies flow downward only: `app -> pages -> widgets -> features -> entities -> shared`.
Modules should import another slice through its public `index.ts` API. Local files inside a
slice may use relative imports.

## Mapping

- Authentication state and route protection remain the `auth` feature.
- Sign-in, sign-up, client dashboard, and empty state become pages.
- The application shell, client sidebar, and campaign sheet become widgets.
- Client and campaign API/query code becomes entity model code.
- Create/edit dialogs and campaign tabs become focused management features.
- Generic components and infrastructure move to `shared`.

## Compatibility

The migration changes module locations only. Existing CSS Modules, API contracts, routes,
and rendered behavior remain unchanged. Tailwind and shadcn/ui stay under `shared/ui` and
`shared/styles`.
