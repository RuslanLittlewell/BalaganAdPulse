## Decisions

- **The projects page draws the bar.** It knows the project in the address for both the project
  and the campaign pages, so one bar serves both and survives moving between them. The app shell
  only hides its sidebar and header.
- **Preview only where it means something.** The app passes preview to the shell only on a
  project's pages; elsewhere the parameter is ignored, so a stray address cannot leave a page
  without navigation or a way out.
- **The client's projects only.** The select lists the projects the member reaches that belong
  to the shown project's client, ordered by name; choosing one keeps the address's other
  parameters, so the period and preview carry over.
