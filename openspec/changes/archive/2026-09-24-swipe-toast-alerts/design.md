## Context

`shared/ui/Alerts/Alerts.tsx` exposes `AlertsProvider` and `useAlerts().raise(message, tone)`,
backed by react-toastify's global `toast()` and a `ToastContainer`. Swipe Toast
(`reactbits.dev/r/SwipeToast-TS-TW.json`) is a single self-managing toast driven by `motion` and
the Web Animations API, with a `fixed` corner mode and an `inline` mode that collapses its own
row when it leaves.

## Decisions

- **Vendor Swipe Toast into `shared/ui/SwipeToast/SwipeToast.tsx`** from the TS+Tailwind variant,
  as Rubber Segment was. Three edits only: the close icon comes from `lucide-react` instead of
  `@hugeicons/*` (two dependencies for one glyph); the close control's label is a `closeLabel`
  prop so it can be Russian through `t()`; and its four `eslint-disable-next-line` comments are
  dropped, since the source-conventions test forbids comments and the project runs no ESLint.
- **The alert column is portalled into `document.body` and exists only while alerts do.** A Radix
  modal hides everything outside itself from assistive technology when it opens; a region
  created afterwards, outside the app root, stays readable.
- **The test stub for `animate` sits on `HTMLElement.prototype`,** not `Element.prototype`:
  motion treats an own `Element.prototype.animate` as Web Animations support and would hand its
  animations to a stub that never finishes.
- **The provider owns a list and renders each toast `inline`** inside one fixed bottom-right
  column. `inline` collapses a leaving toast's row, so the stack closes up; the fixed mode would
  pile every toast on the same spot. A toast is removed from the list from its `onClose`.
- **Tone** picks the icon and the fuse colour, and the wrapping live region: `role="alert"` for
  errors, `role="status"` for successes.
- **Duration stays 8 s**, the value react-toastify was configured with.
- **Tests** stub `Element.prototype.animate` in the shared setup, since jsdom has no Web
  Animations API; the stub lets a test finish the fuse to exercise the timeout.

## Risks / Trade-offs

- [The vendored file drifts from upstream] → The two edits are recorded here; a re-vendor repeats
  them.
