## 1. Two-line Meta integration panel

- [x] 1.1 Write and observe failing web tests for a healthy panel showing its heading and only the last import and last lead poll times, no schedule, status, account, currency or lead state; nothing about leads before the first poll; the refresh control showing activity and refusing clicks while an import is queued; and failures (expired token, lead access, failed lead poll) still explained while they apply.
- [x] 1.2 Remove the schedule, status and lead state lines from `MetaIntegration`, show refresh activity on its control, and drop the unused copy from `ru.ts`.
- [x] 1.3 Run `npm test` and `npm run test:web` until both are green.
