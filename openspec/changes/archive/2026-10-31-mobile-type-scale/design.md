## Context

`tokens.css` defines the app's own type scale in `@theme` (`--text-xs` 10 px, `--text-sm` 12 px,
`--text-base` 14 px, up to `--text-9xl`), with line heights in `rem`. Utilities read these
variables at run time. Body text has no size of its own and inherits the browser's 16 px. Some
small labels bypass the scale with `text-[8px]` to `text-[13px]`.

## Goals / Non-Goals

**Goals:**
- Text 0.85 of its size on a phone, in proportion across the scale.

**Non-Goals:**
- Spacing, radii and component sizes, which stay as they are.
- Vendored components (`shared/ui/ui/`) and the toast, which set their own sizes.

## Decisions

- **One factor, `--type-scale`**, set to `0.85` on `:root` below `md` in the base layer and
  read with a fallback of `1`. Each `--text-*` step and each `rem` line height becomes
  `calc(<size> * var(--type-scale, 1))`, so the scale keeps one source and the factor one place
  to tune. Scaling the root font size instead would shrink every `rem` spacing and width too.
- **Body text gets `calc(1rem * var(--type-scale, 1))`**, which is the browser's 16 px on a wide
  screen, so unclassed text shrinks with the rest.
- **`text-[11px]` becomes `text-2xs`**, a new scale step of 11 px with no line height of its own,
  so it keeps inheriting the line height as the fixed size did and its desktop look is unchanged.
- **8–10 px labels stay fixed.** At 0.85 they would fall under 8 px.
- **No new tests.** Sizes are styling, which the project does not test.
