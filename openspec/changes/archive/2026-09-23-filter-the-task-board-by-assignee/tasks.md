## 1. The control that chooses several people

- [x] 1.1 Write and observe failing web tests for a shared multi-select: it names what is
  chosen on its face, opens a menu of options each carrying a name and an avatar, marks the
  chosen ones with `aria-checked`, reports a choice and an unchoice to its caller, stays open
  while several are chosen, and is reachable and operable from the keyboard.
- [x] 1.2 Add the control under `apps/web/src/shared/ui/`, composed from the vendored
  `DropdownMenuCheckboxItem` and `MemberAvatar`, and export it from the barrel.
- [x] 1.3 Run `npm run test:web` until green.

## 2. What the filter offers and what it keeps

- [x] 2.1 Write and observe failing tests for the model that derives the options from a list
  of tasks and the memberships in hand: it offers each member responsible for a visible task
  once, names them from the membership listing, falls back to the id when no membership is in
  hand, offers the unassigned entry only while an unassigned task is visible, and keeps a
  chosen member who no longer holds a visible task.
- [x] 2.2 Write and observe failing tests for narrowing a list of tasks by a chosen set:
  nothing chosen shows everything, one chosen shows only theirs, several show the union, and
  the unassigned entry shows the tasks with no responsible member.
- [x] 2.3 Add the model beside the task entity's other pure helpers.
- [x] 2.4 Run `npm run test:web` until green.

## 3. The filter on the module's header

- [x] 3.1 Write and observe failing tests on `TasksPage`: the filter sits in the header, the
  board shows only the chosen member's tasks, unchoosing the last member shows everything
  again, the calendar is narrowed by the same choice, switching between the views keeps it,
  and a manager whose board holds only their own tasks cannot surface a colleague's.
- [x] 3.2 Render the control in the header beside the title and narrow the array handed to
  `TaskBoard` and `TaskCalendar`.
- [x] 3.3 Run `npm run test:web` until green.

## 4. Remembering whose work was chosen

- [x] 4.1 Write and observe failing tests: the chosen members survive leaving the module and
  coming back, survive a reload, and belong to the member who chose them rather than to the
  browser.
- [x] 4.2 Add the per-user map and its action to `moduleMemory`, name it in `partialize`, and
  read and write it from `TasksPage` the way the chosen view already is.
- [x] 4.3 Run `npm run test:web` until green.

## 5. Close the change

- [x] 5.1 Add every new string to `ru.ts` and reach it through `t("key")`, including the
  control's label, its accessible name, the unassigned entry and whatever it says when
  nothing is chosen.
- [x] 5.2 Run the web production build, then `npm test` and `npm run test:web` until both are
  green.
- [x] 5.3 Run `openspec validate filter-the-task-board-by-assignee --strict` and confirm the
  implementation matches every scenario in the delta spec.
