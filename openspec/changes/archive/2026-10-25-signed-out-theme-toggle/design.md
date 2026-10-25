## Decisions

- **In the panel, beside the title.** `CenteredPanel` renders the toggle itself in its card
  header's action slot, so every screen built on it gets the control at the title's height and no
  page hands a button down as a prop.
- **The toggle moves to `shared/ui`.** `CenteredPanel` is in `shared` and may not import a feature.
  `ThemeToggle` only uses the theme helpers of `shared/lib` and the shared `Button`, so it belongs
  in `shared` and the headers import it from there.
- **The same toggle.** The choice is stored the same way and carries over after signing in.
