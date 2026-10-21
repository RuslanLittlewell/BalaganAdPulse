## Context

A campaign's indicator and a project's marker are decided by two small functions with their own
boundary constants, both on the percent the KPI tile shows. The dashboard gauge counts a project
as meeting its KPI when the marker is green.

## Decisions

- Move the two boundaries in both functions to 90 and 70; the zones stay the same three.
- The gauge keeps following the marker, so "meets its KPI" there reads as 90% or more.
- The "KPI achieved" notification is an event about the plan being reached, not a zone, and
  stays at 100%.
