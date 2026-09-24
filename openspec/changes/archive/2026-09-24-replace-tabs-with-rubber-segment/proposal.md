## Why

Every tab-style switch in the app — the board/calendar toggles on the CRM and Tasks
pages, and the Clients/Employees selector inside the contact-book modal — is a plain
click-to-select control with no motion, and switching between the app's top-level
modules (Dashboard, CRM, Projects, Tasks, Reports, Archive) cuts instantly with no
transition. Both read as unfinished next to the rest of the shell. A rubber-thumb
segmented control (reactbits.dev's Rubber Segment) and a module-to-module fade close
that gap using `motion`, a dependency the app already has and already uses for the
same animation idiom elsewhere.

## What Changes

- Every existing tab switcher is replaced by a new rubber-thumb segmented control:
  `CrmPage`'s board/calendar toggle, `TasksPage`'s board/calendar toggle, and
  `ContactBook`'s Clients/Employees selector inside its modal.
- The shared `Tabs` component (`apps/web/src/shared/ui/Tabs/Tabs.tsx`) is rewritten on
  top of the new control instead of the vendored Radix tabs primitive. The two page
  call sites that use the vendored primitive directly (`CrmPage`, `TasksPage`) move to
  the same shared component instead. The vendored `shared/ui/ui/tabs.tsx` file is left
  in place, unused, since vendored files are kept as they arrived.
- **BREAKING**: the switcher's accessibility semantics change from ARIA tabs
  (`role="tablist"`/`"tab"`) to a segmented control (`role="radiogroup"`/`"radio"`),
  and it gains drag/flick selection in addition to click and arrow-key selection.
- Switching between top-level modules now cross-fades instead of cutting instantly.
  The fade is skipped for members who prefer reduced motion.

## Capabilities

### New Capabilities
- `segmented-control`: a draggable rubber-thumb segmented control used for every
  single-select switcher in the app, including inside modals.
- `module-transitions`: a fade transition plays when a signed-in member switches
  between the app's top-level modules.

### Modified Capabilities
(none — capabilities that happen to use a switcher, e.g. `contact-directory`, specify
the selector's presence and options, not its widget or animation, and remain true
unchanged)

## Impact

- Frontend only (`apps/web`). Touches `shared/ui/Tabs/Tabs.tsx` (rewritten), a new
  low-level segmented-control primitive under `shared/ui/`, the three call sites
  (`pages/crm/CrmPage.tsx`, `pages/tasks/TasksPage.tsx`,
  `widgets/contact-book/ContactBook.tsx`), the module-rendering point
  (`app/App.tsx`/`widgets/app-shell/AppShell.tsx`), and their tests under the mirrored
  `apps/web/test/` tree.
- No new dependency: `motion` is already installed and already used for the same
  `AnimatePresence`/`variants` idiom in `shared/ui/Stepper/Stepper.tsx`.
- No backend, schema or API changes.
