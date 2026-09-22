## Context

Two tab widgets exist today: the vendored Radix primitive
`shared/ui/ui/tabs.tsx` (imported directly by `CrmPage.tsx` and
`TasksPage.tsx`), and the app's own `shared/ui/Tabs/Tabs.tsx` wrapper around it
(`items`/`activeId`/`onSelect` API, used once, inside the `ContactBook` modal).
reactbits.dev's Rubber Segment (TS+Tailwind variant) is a single-file component
driven by `motion/react` (`animate`, `motion`, `useMotionValue`,
`useReducedMotion`, `useTransform`). `motion` is already a project dependency and
already drives the same `AnimatePresence`/`variants` idiom in
`shared/ui/Stepper/Stepper.tsx`. Module content renders inside `AppShell.tsx`'s
`<main>`, fed by the `<Routes>` tree from `App.tsx`'s `Dashboard()`, with no
transition today. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- One segmented-control primitive, vendored from Rubber Segment, used by all
  three existing tab call sites.
- Preserve the parts of `Tabs.tsx`'s public API that callers actually use
  (`items`/`activeId`/`onSelect`), so call sites change minimally.
- A cross-fade between top-level modules, skipped under reduced motion, that
  does not fire for in-module navigation.

**Non-Goals:**
- Redesigning the contact-book modal, the board/calendar pages, or the
  navigation IA beyond swapping the control and adding the fade.
- Removing the vendored `shared/ui/ui/tabs.tsx` file — it stays in place,
  unused, per the vendored-file convention.
- A generic page-transition system for every route; only the module boundary
  gets the fade.

## Decisions

1. **Vendor Rubber Segment as a new primitive**, `shared/ui/RubberSegment/RubberSegment.tsx`,
   copied from the TS+Tailwind variant — it matches the project's Tailwind-only
   styling convention, where the CSS-file variant would introduce the project's
   first component-scoped stylesheet. Its own `value`/`onChange`/`items` prop
   names are kept as-is at this layer.

2. **Rewrite `Tabs.tsx` to render the new primitive internally**, keeping its
   existing external API (`items: {id,label}[]`, `activeId`, `onSelect(id)`) so
   `ContactBook.tsx` needs no call-site change beyond the accessibility-role
   change already called out as **BREAKING** in the proposal. `CrmPage.tsx` and
   `TasksPage.tsx` move from importing the vendored Radix primitive directly to
   importing this same `Tabs` wrapper, leaving exactly one switcher
   implementation in the app.
   - *Alternative considered*: a new, differently-named `SegmentedControl`
     wrapper, leaving `Tabs.tsx` untouched. Rejected — it would leave two
     "current" tab-shaped components after this change, one of them still
     routing through the vendored Radix primitive this change is trying to
     retire from app code.

3. **Drop `itemActions`/`onNew`** (per-tab hover icon actions, trailing "+ add"
   button) from `Tabs.tsx`'s public surface. No current caller uses them —
   `ContactBook.tsx` is the only caller and passes neither. Rubber Segment's
   item slot is a label/icon pair with no independent interactive child;
   nesting a real `<button>` inside its draggable `role="radio"` button is
   invalid HTML and would fight its own pointer/drag handling. A future screen
   that needs inline tab actions is a new design problem for that screen, not
   something this control should carry unused today.

4. **Module fade**: wrap the `{children}` slot in `AppShell.tsx` (which
   receives the `<Routes>` tree) in `AnimatePresence mode="wait"` from
   `motion/react`, keyed on the current module — derived from the first path
   segment, not the full `location.pathname`. Keying on the module rather than
   the full path is what makes "navigation within a module does not fade"
   hold: a route change inside the same module (switching board/calendar view,
   opening a project) keeps the same key and never remounts the fade wrapper.
   Timing mirrors `Stepper.tsx`'s existing precedent — `opacity` variants,
   `useReducedMotion()` short-circuiting to duration `0` — but at
   `transition={{ duration: 0.2 }}`, shorter than the Stepper's 0.4s step beat,
   since this covers a full-page swap that should feel snappy rather than a
   deliberate wizard pace.
   - *Alternative considered*: key on `location.pathname` directly. Rejected —
     it would also fade on every sub-navigation (opening a project, switching
     CRM board), violating "navigation within a module does not fade" and
     making routine navigation feel sluggish.
   - *Alternative considered*: `mode="sync"` (what `Stepper` uses — cross-fades
     in and out simultaneously). The module fade uses `mode="wait"` instead:
     two overlapping full module trees briefly double-rendering their own
     data-fetching widgets is heavier and noisier than two overlapping wizard
     panels; `mode="wait"`'s brief gap is acceptable at 0.2s.
   - **Pitfall found in manual testing, fixed**: `<Routes>` must be given an
     explicit `location={location}` prop (`location` from `useLocation()` in
     `Dashboard()`). Without it, `<Routes>` matches against the router's live
     context internally, and React's context propagation re-renders the
     *exiting*, mid-fade-out `<Routes>` instance against the *new* URL the
     moment navigation happens — since `AnimatePresence` keeps the outgoing
     element mounted (with its old props otherwise frozen) rather than asking
     the parent to re-supply it, an explicit `location` prop is what actually
     stays pinned to the old value for that instance, keeping the fade-out
     showing the outgoing module instead of the incoming one. Symptom before
     the fix: a double flash of the *new* module's content instead of a
     cross-fade from old to new. Covered by
     `test/app/App.test.tsx`'s "keeps the outgoing module visible while the
     incoming one fades in" test.
   - **Second pitfall found in manual testing, fixed**: the `motion.div`
     wrapper needs `className="h-full"`. Several pages (`ProjectList`'s
     `flex-1` end-of-list drop zone, `CrmPage`, `TasksPage`) depend on an
     unbroken `h-full`/`flex-1` chain from `<main>` down to size themselves
     to the viewport and position `absolute`-positioned floating buttons
     correctly. A plain, unstyled `motion.div` inserted into that chain
     collapses to its content's height instead of `<main>`'s, so anything
     positioned `absolute bottom-*` relative to a now-collapsed ancestor ends
     up outside the visible area — symptom: the project-create floating
     button "disappeared" (it was still in the DOM and accessible, just
     rendered off-screen). This is a layout-only regression jsdom cannot
     detect (no real layout engine), so it isn't covered by an automated
     test; caught by the person using the app.

5. **Accessibility role change** (ARIA tabs → segmented control) is accepted as
   the proposal's stated **BREAKING** change. `Tabs.test.tsx`, and any other
   test asserting `role="tab"`, are updated in the same slice that rewrites
   `Tabs.tsx`, per TDD — the red test is written against the new roles first.

## Risks / Trade-offs

- [Dragging the indicator on a touch device could fight vertical page scroll]
  → Rubber Segment already sets `touch-action: pan-y` on its track, so vertical
  scroll is preserved; called out here so it isn't rediscovered as a bug.
- [`AnimatePresence mode="wait"` unmounts the outgoing module before the
  incoming one mounts, so a module with no loading skeleton could show a brief
  blank frame] → 0.2s reads as a fade, not a blank flash, for the modules this
  change touches; a module whose own loading state looks bad under this needs
  that module's loading UI fixed, not this transition removed.
- [Copying Rubber Segment's source in-repo won't pick up upstream fixes
  automatically] → the same trade-off the project already accepts for the
  vendored `shared/ui/ui/` primitives; the file is small enough to diff by hand
  against upstream later if needed.
