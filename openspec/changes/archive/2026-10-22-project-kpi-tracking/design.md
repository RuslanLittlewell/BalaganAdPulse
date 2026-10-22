## Decisions

- **A flag on the project.** `kpi_tracked`, true by default, is part of the project's record and
  changed through the project's update with the other fields, so it follows the same realtime
  refresh of the project list.
- **Changing it needs the right to change KPIs as well as to update the project.** A member who
  may only edit the project's name cannot switch tracking, and the API refuses with 403.
- **The summary hides the KPIs of an untracked project.** The projects summary returns an empty
  `kpis` list for it, so every consumer, the project list marker, the dashboard table column and
  trend, reads it as a project without a KPI with no further change. The project page reads the
  KPIs from their own endpoint, which is unaffected, so they stay editable there.
- **The dashboard's counts leave it out.** The gauge and the Важная информация panel skip an
  untracked project altogether instead of counting it as unrated, because it is not missing a
  KPI by neglect.
- **No notification.** The KPI-met notification is not sent for an untracked project.
