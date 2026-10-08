## Why

API sources reach other modules, and deeper layers of their own module, through relative
paths such as `../../modules/leads/index.js`: 133 imports climb two or more directories.
They are hard to read, break when a file moves, and hide where an import really points.

## What Changes

- `apps/api/package.json` gains a `#modules/*` subpath import beside the existing
  `#shared/*`, resolving to `src/modules/*` in development and tests and `dist/modules/*`
  under the `compiled` condition in production.
- Every source import that climbs two or more directories, or leaves the importing file's
  own module, is rewritten to `#modules/…` or `#shared/…`.
- The architecture test resolves `#modules/` and `#shared/` specifiers, so the public-index
  and layer rules keep applying to aliased imports, and enforces the convention: a relative
  import climbs at most one directory, and another module is reached through `#modules/`.
- No behaviour changes.

## Capabilities

### New Capabilities

### Modified Capabilities

## Impact

- `apps/api/package.json`, the imports of 60 files under `apps/api/src`, and
  `apps/api/test/architecture/import-graph.ts`.
- Tests keep their relative imports for now.
