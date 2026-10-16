## 1. Aliases

- [x] 1.1 Add `#modules/*` to `apps/api/package.json`.
- [x] 1.2 Teach the architecture test to resolve `#modules/` and `#shared/`, and to reject relative imports that climb two directories or reach another module.
- [x] 1.3 Rewrite the imports under `apps/api/src`.
- [x] 1.4 Run `npx tsc --noEmit`, `npm run build` and `npm test` until green; `openspec validate api-import-aliases --strict`.
