## Decisions

- **The address holds the mode.** `?preview=1` is read by a shared hook. Entering pushes it, so
  the back button leaves; leaving removes it. The project page already carries its search when it
  opens a campaign and comes back, so the mode follows without extra wiring.
- **Each layer hides its own chrome.** The app shell hides the sidebar and the header and offers
  the exit button; the projects page hides the project list; the project page shows only the
  metrics section. No layer needs to know about the others.
- **Read-only figures.** In preview the summary is not configurable and the KPI tiles have no edit
  control; the period, the account tabs, the running-only switch, sorting and opening a campaign
  keep working, as they only change what is looked at.
