## Decisions

- **The header draws the button.** The project header is an entity component and cannot reach
  the preview feature; it renders the button itself when the page passes `onPreview`, the same
  way it shows the KPI-tracking switch.
- **Full-screen icon.** Preview takes the whole window for the figures, as a player's full screen
  does, so it borrows that icon; leaving uses the exit icon.
- **Shared divider.** The app header's divider becomes a shared `ToolbarDivider`, used by both
  headers.
