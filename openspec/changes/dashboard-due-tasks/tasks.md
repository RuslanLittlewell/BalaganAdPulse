## 1. The rule

- [x] 1.1 Add `dueSoon` to `entities/task/lib/due.ts`: participant, not done, dated, within overdue to two days ahead in the viewer's zone, ordered overdue first then by day, time and priority; export it
- [x] 1.2 Add `useDueTasks` to `widgets/agency-overview`: live through the task events and refreshed at midnight, with the section rendered only when the tasks module is on

## 2. The dashboard section

- [x] 2.1 Add the `DueTasks` card to `widgets/agency-overview` with the loader, empty, error with retry and list states, render it third after `ImportantInfo`, and give the dashboard grid four columns from `xl` when the tasks module is on
- [x] 2.2 Add the Russian copy to `ru.ts`
- [x] 2.3 Keep the existing dashboard tests passing by mocking the tasks request where the module is on

## 3. Tests

- [x] 3.1 Unit tests for `dueSoon`: today, two days ahead, three days ahead, overdue, someone else's, done and archived, undated, the viewer's time zone, and every ordering rule
- [x] 3.2 Component tests: the labelled list, links to the opened task, the loader, empty and error with retry, no request with the module off, and the block third in the dashboard
