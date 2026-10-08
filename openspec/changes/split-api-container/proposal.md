## Why

`apps/api/src/composition/create-container.ts` wires every module in one 270-line function
behind 76 imports. Modules interleave in dependency order, some use cases are built inside
the returned object, and adapters are constructed more than once, so finding how one module
is wired means reading all of them.

## What Changes

- The container's wiring moves into one file per module under `composition/wiring/`, each a
  `wire…` function that takes the shared kernel and, as named parameters, what it needs from
  other modules, and returns its use cases and routers.
- `createContainer` keeps the `ApiContainer` contract and becomes the table of contents:
  the shared kernel, the `wire…` calls in dependency order, and the returned object.
- Duplicated adapters are built once: the campaign repository, the credential cipher and
  the Graph provider; the client reach adapter is written once. Members keep their own
  read of users, as before, since identity's routers need presence, which needs members.
- The fire-and-forget-and-log pattern used five times becomes one helper.
- No behaviour, route, API contract or configuration changes.

## Capabilities

### New Capabilities

### Modified Capabilities

## Impact

- `apps/api/src/composition/create-container.ts` and new `apps/api/src/composition/wiring/*.ts`.
- Nothing outside `composition/` changes; the API test suite exercises every wire.
