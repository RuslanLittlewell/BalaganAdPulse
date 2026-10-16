## Context

`ProjectItem` renders a project in two forms. Wide, it is a `ListItem` whose `marker` and
`markerLabel` draw the bar on the right and name the KPI state for screen readers. Narrowed,
it is a bare button around `ProjectAvatar`, named by `aria-label` with the project's name,
and receives the same `tone` but does nothing with it.

## Goals / Non-Goals

**Goals:**
- The same tone, colour tokens and wording in both forms.

**Non-Goals:**
- Changing the wide row or the tone itself.

## Decisions

**A dot on the picture's bottom-right corner.** The avatar is wrapped in a relative span and
a `size-2.5` circle sits on its corner, painted with the same `--kpi-marker-*` token as the
bar and ringed in the page background so it reads on any picture. The bottom-right corner
is where presence dots sit elsewhere in interfaces, and it leaves the picture recognisable.

**The state is the button's description, not its name.** The button keeps its name, the
project's name, which the tooltip, the tests and the context menu rely on; the KPI wording
goes into a visually hidden element referenced by `aria-describedby`. Folding it into the
name would make every picture announce its state before its project.
