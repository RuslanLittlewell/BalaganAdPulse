## Why

An unslop audit of the web app found craft faults that make it read as generated rather than
designed. The Tailwind spacing step is 3.2px (`--spacing: 0.2rem`), so most paddings, gaps and
sizes land on fractions like 6.4, 9.6 and 12.8px, off the 4px grid, with soft edges and an uneven
rhythm. Labels shout in uppercase with wide tracking, the shell is frosted glass with a heavy
shadow, the add tiles glow, and task and lead cards carry colored stripes on top of colored
badges, so color spreads over the chrome and nothing leads.

## What Changes

- The spacing step becomes 4px, and every spacing and size utility in `apps/web/src` moves to the
  nearest multiple of 4px of its current value, so the density stays as it is.
- Uppercase tracked labels become sentence case at normal tracking.
- Headings and the logo drop from weight 700 to 600.
- Text smaller than 11px in the interface grows to the smallest step of the type scale.
- One-off pixel values move onto the scale.
- The date picker loses its frosted glass. The shell drops its heavy shadow and keeps its
  translucency and blur, because the sticky first column of the tables relies on them to show the
  figures that scroll beneath it.
- The add tiles lose their glow and their growing plus.
- The CRM add column no longer runs the full height of the board.
- Task cards keep their priority stripe, and the priority badge becomes quiet. Lead cards lose
  their stage stripe; the column header already names the stage.
- `transition-all` and scaling on hover go.
- Out of scope, offered as suggestions: neutral surfaces in place of the mint and navy tints, one
  color for project avatars, a dash for an empty ROAS, and table headers that do not truncate.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. The change alters the look only; every specified behaviour stays, including the dashed add
controls and the KPI markers.

## Impact

- `apps/web/src`: Tailwind classes across components, `shared/styles/tokens.css`, `AppShell`,
  `AddTile`, `PeriodControl`, task and lead cards, `SectionLabel`, `MetricCard` and the other
  labels found by the audit.
- No API, data or behaviour change. Tests that assert behaviour keep passing.
