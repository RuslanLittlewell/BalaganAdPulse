## 1. Unreachable code

- [x] 1.1 Delete `composition/index.ts`, `shared/infrastructure/date.ts`, `shared/infrastructure/index.ts`, `shared/presentation/index.ts`, and `sumAmounts`, `isMonth`, `lastDay`, `nullableRef`.
- [x] 1.2 Remove `decimal.js`, and `INVITE_CODE` from compose, CI, `.env.test` and README.
- [x] 1.3 Remove the legacy inventory from the architecture test.
- [x] 1.4 `npm test` green.

## 2. One project access rule

- [x] 2.1 Add `reachableProjects` to the shared kernel and use it in the leads, integrations, campaigns, tasks, projects and project-layout repositories.
- [x] 2.2 `npm test` green.

## 3. One error hierarchy

- [x] 3.1 Replace `NotFoundError` and `ValidationError` with `AppError`, drop the unused classes, move `ServiceUnavailableError` into the concurrency gate and delete `http-errors.ts`.
- [x] 3.2 `npm test` green.

## 4. Metric recording

- [x] 4.1 Remove the recording methods from `MetricRepository` and its Prisma adapter; seed figures in tests through Prisma.
- [x] 4.2 `npm test` green.

## 5. Exports

- [x] 5.1 Unexport symbols only their own file uses, drop unused index re-exports and the duplicate default exports.
- [x] 5.2 knip reports no unused files, dependencies or value exports; `npx tsc --noEmit`, `npm run build` and `npm test` green; `openspec validate backend-cleanup --strict`.
