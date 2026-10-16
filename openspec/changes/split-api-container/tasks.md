## 1. Split the container

- [x] 1.1 Add `composition/wiring/kernel.ts` with the shared kernel and `runDetached`.
- [x] 1.2 Move each module's wiring into its `wire…` file, building duplicated adapters once.
- [x] 1.3 Reduce `createContainer` to the kernel, the `wire…` calls and the returned `ApiContainer`.
- [x] 1.4 Run `npx tsc --noEmit` and `npm test` until green; `openspec validate split-api-container --strict`.
