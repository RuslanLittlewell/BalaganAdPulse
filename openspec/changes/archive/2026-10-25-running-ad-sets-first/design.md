## Decisions

- **Same rule as the project page.** Running means active or learning (`isRunning`); the switch is
  local state reset whenever the campaign changes, never remembered.
- **Both levels.** The switch narrows the ads of an expanded ad set as well, since a paused ad under
  a running ad set is as much noise as a paused ad set.
- **Order kept.** Running entries first, each group in its existing order, as campaigns are.
