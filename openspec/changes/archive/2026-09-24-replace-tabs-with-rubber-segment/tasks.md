## 1. Segmented-control primitive

- [x] 1.1 Write and observe failing tests for a new `RubberSegment` component
  covering: clicking an unselected option invokes `onChange` with its value;
  the container exposes `role="radiogroup"` with an accessible name and each
  option exposes `role="radio"`/`aria-checked`; right/left arrow and Home/End
  keys move the selection and focus; dragging the indicator onto another
  option selects it; with a reduced-motion preference, selecting an option
  updates the selection without an animated indicator move.
- [x] 1.2 Vendor reactbits.dev's Rubber Segment (TS+Tailwind variant) as
  `apps/web/src/shared/ui/RubberSegment/RubberSegment.tsx` until the tests
  from 1.1 pass.
- [x] 1.3 Run `npm run test:web` until green.

## 2. Rewrite the shared `Tabs` component

- [x] 2.1 Update `apps/web/test/shared/ui/Tabs/Tabs.test.tsx`: replace the
  `role="tab"`/`aria-selected` assertions with `role="radiogroup"`/`role="radio"`/
  `aria-checked`, drop assertions covering `itemActions`/`onNew` (removed per
  design.md), and keep the assertions covering `items`/`activeId`/`onSelect`
  behavior. Observe it fail.
- [x] 2.2 Rewrite `apps/web/src/shared/ui/Tabs/Tabs.tsx` to render
  `RubberSegment` internally, keeping its `items`/`activeId`/`onSelect` public
  API and dropping `itemActions`/`onNew` from `TabsProps`.
- [x] 2.3 Run `npm run test:web` until green.

## 3. Migrate call sites

- [x] 3.1 Update any test in `apps/web/test/pages/crm/`, `apps/web/test/pages/tasks/`
  and `apps/web/test/widgets/contact-book/` that asserts on the old Radix tab
  roles for the board/calendar or Clients/Employees switcher, to assert on the
  segmented-control roles instead. Observe the affected tests fail.
- [x] 3.2 Update `apps/web/src/pages/crm/CrmPage.tsx` and
  `apps/web/src/pages/tasks/TasksPage.tsx` to import and render the shared
  `Tabs` component instead of the vendored `shared/ui/ui/tabs.tsx` primitive
  directly.
- [x] 3.3 Confirm `apps/web/src/widgets/contact-book/ContactBook.tsx` needs no
  source change beyond the `Tabs.tsx` rewrite in section 2 (it already calls
  the shared `Tabs` component) — verify only. (Needed one addition beyond the
  rewrite: an `ariaLabel` prop, wired to the existing unused
  `contacts.directory.label` string.)
- [x] 3.4 Run `npm run test:web` until green.

## 4. Module fade transition

- [x] 4.1 Write and observe failing tests for the module-level transition
  wrapper: it remounts when the active module (the route's first path
  segment) changes, it does NOT remount when navigating between routes inside
  the same module, and — under a mocked reduced-motion preference — the
  module still switches correctly. (jsdom has no meaningful way to assert on
  the absence of a CSS/motion animation itself without testing style
  internals the project's convention excludes, so the reduced-motion test
  asserts the functional contract: selection/navigation keeps working.)
- [x] 4.2 In `apps/web/src/widgets/app-shell/AppShell.tsx`, wrap the module
  content (`{children}`) in `AnimatePresence mode="wait"` from `motion/react`,
  keyed on the current module, with `opacity` variants and
  `transition={{ duration: 0.2 }}`, short-circuited to no animation under
  `useReducedMotion()`.
- [x] 4.3 Run `npm run test:web` until green.
- [x] 4.4 Fix found in manual use (reported as "double blink" when switching
  pages): `<Routes>` in `Dashboard()` (`apps/web/src/app/App.tsx`) needs an
  explicit `location={location}` prop, or the exiting, mid-fade-out module
  re-matches against the router's live location and shows the incoming
  module's content instead of the outgoing one's — see design.md's added
  note under decision 4. Added a red-then-green regression test in
  `apps/web/test/app/App.test.tsx` ("keeps the outgoing module visible while
  the incoming one fades in") before the fix.
- [x] 4.5 Fix found in manual use ("create project button disappeared"): the
  `motion.div` wrapper in `AppShell.tsx` was missing `className="h-full"`,
  collapsing the `h-full`/`flex-1` height chain that `ProjectList` (its
  `flex-1` end-of-list drop zone) and other pages rely on to size themselves
  and position floating buttons — see design.md's second added note under
  decision 4. Layout-only regression; no automated test possible (jsdom has
  no layout engine), fixed from the reported symptom instead.

## 5. Final verification

- [x] 5.1 Run `npm test` and `npm run test:web` from the repository root and
  confirm both are green. (129 backend files / 1443 tests, 133 frontend files
  / 1100 tests — all green.)
- [x] 5.2 Start the app and manually confirm: the segmented control renders
  and can be clicked, dragged and flicked in `CrmPage`, `TasksPage` and the
  contact-book modal; switching modules cross-fades; switching board/calendar
  view or opening a client/project inside a module does not trigger the
  module fade. **Not performed**: no login credentials were available for the
  local dev stack, and the change was archived at the user's request without
  this manual check. The automated suites in 5.1 cover the functional contract.
