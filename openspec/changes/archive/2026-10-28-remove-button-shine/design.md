## Context

`shared/ui/Button` wraps the vendored base button and, for every variant but ghost and
link, adds an absolutely positioned `Specular` layer and `relative` positioning for it.

## Goals / Non-Goals

**Goals:**
- No WebGL context, animation frame or window pointer listener per button.

**Non-Goals:**
- A replacement hover effect; buttons keep the base hover styles.
- The backdrop blur and the bundle size, which are separate changes.

## Decisions

- **`shared/ui/Button` stays as the import path and re-exports the base button.** Six shared
  components and the `shared/ui` index import it there; keeping the path avoids touching
  them, and the vendored `ui/button` stays as it arrived.
- **`relative` goes with the shine.** It only anchored the shine layer; buttons that need a
  position set their own `absolute` class, which wins either way.
- **`Specular` is deleted rather than kept unused.** It can come back from history.

## Risks / Trade-offs

- [A button child positioned against the button relied on `relative`] → none found in the
  sources; the buttons placed with `absolute` set it on the button itself.
