## Context

The module imitations are Astro components inside `MockWindow`, sized by their content. The deck
moves whatever sits in each article's panel and scales it to fit the screen's height.

## Decisions

- **A fixed canvas scaled as a whole.** `AppScreen` is a 16:10 frame. Its canvas is laid out at
  1280 by 800 pixels and a script scales it to the frame's width with a transform, watching the
  frame with a `ResizeObserver`. The pages then use the app's own text sizes and spacing, and the
  result reads like a screenshot at any width. CSS cannot divide a container width by a pixel
  length in today's browsers, so the scale is set from script.
- **Without scripts the canvas fills the frame.** Until the script runs the canvas is laid out at
  the frame's own size, so every text is in the document and nothing overflows.
- **One navigation for every screen.** `AppSidebar` renders the app's navigation with one module
  chosen; the opening's dashboard and every module screen use it.
- **The dashboard body is shared.** The opening's imitation keeps its loading animation around a
  `DashboardBody`; the deck shows the same body in an `AppScreen` without the animation.
