## Why

`ContactBook.tsx` renders the Clients directory's list, selection state, and
detail/edit panes inline, while the Employees directory already lives in its
own `EmployeeDirectory` component. The asymmetry makes `ContactBook.tsx` the
largest, hardest-to-scan file in the widget, and hides the fact that the two
directories are independent, swappable panes behind one switcher — exactly
the shape `EmployeeDirectory` already models correctly.

## What Changes

- Extract the Clients directory's list, selection state, and detail/edit
  panes out of `ContactBook.tsx` into a new, self-contained `ClientDirectory`
  component, mirroring the existing `EmployeeDirectory`.
- `ContactBook.tsx` keeps owning the `Dialog` chrome and the `Tabs` switcher
  (the directory switcher stays in the parent, not duplicated into either
  directory component) and renders `ClientDirectory` or `EmployeeDirectory`
  based on the selected tab.
- No behavior, markup, `data-testid`s, or copy change — this is a pure
  internal restructuring. `skip_specs: true` is set in `.openspec.yaml`
  accordingly.

## Capabilities

### New Capabilities
(none — no spec-level behavior changes)

### Modified Capabilities
(none — `contact-directory`'s requirements describe what the modal does, not
how its React components are split, and remain true unchanged)

## Impact

- Frontend only, one widget: `apps/web/src/widgets/contact-book/`. New file
  `ClientDirectory.tsx`; `ContactBook.tsx` shrinks to Dialog chrome + Tabs +
  directory dispatch. No test changes expected, since the rendered output is
  unchanged.
