Every implementation task follows TDD: add the failing test, observe it fail, then implement.

## 1. The reader is not in the directory

- [x] 1.1 Write the failing tests: colleagues are listed, the reader is not, a directory of one says so, and the assignee select still offers them.
- [x] 1.2 Leave the reader out where the directory is drawn.
- [x] 1.3 Run `npm run test:web` — green.

## 2. A project as its picture and its name

- [x] 2.1 Write the failing tests for the picture beside the name, in the granted list and in the control that adds one.
- [x] 2.2 Write the failing tests for removal: a cross on the picture, a question naming the project, nothing changing until it is agreed to, and nothing changing when it is declined.
- [x] 2.3 Implement both, and add the Russian strings.
- [x] 2.4 Run `npm run test:web` — green.

## 3. Acceptance

- [x] 3.1 Run `openspec validate refine-employee-directory --strict`.
- [x] 3.2 Run `npm test`, `npm run test:web`, `npm run build`, `npm run build:web` — all green.
