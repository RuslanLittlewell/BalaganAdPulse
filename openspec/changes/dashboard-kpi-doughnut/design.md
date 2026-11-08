## Context

See proposal.md and specs/kpi-overview/spec.md. `KpiGauge` draws a half circle with SVG: one grey base arc and three colored arcs laid over it with `pathLength` and `strokeDasharray`, a needle rotated to the met share, and the count below. The counts come from `monthlyKpiStandings` and are unchanged.

## Goals / Non-Goals

**Goals:**
- Replace the drawing and keep the data, the legend, the title, the period and the accessible text as they are.

**Non-Goals:**
- A charting library for one ring. The SVG stays hand-drawn like the other charts of the app.
- Animation of the ring, or a hover tooltip. The legend already gives every count.

## Decisions

### A ring of four circles in one SVG

The SVG is a square with a circle of radius 38 and a stroke of 14, rotated by -90 degrees so the first group starts at the top. Each group is a circle with `pathLength` of 100, a `strokeDasharray` of its share and the rest, and a `strokeDashoffset` that moves it past the groups before it. A group with no projects draws nothing. With no projects at all one grey full circle is drawn. This keeps the technique of the gauge and needs no trigonometry.

### The number in the middle is HTML over the SVG

The middle reads N из M and nothing else, since the card's title already says what it counts. It is a block centered over the ring, not SVG text, so it follows the app's fonts and sizes and the browser lays the text out. The SVG keeps its role of image and its label with the four counts, so assistive technology reads the counts once.

### Segments are outlined ring sectors with a translucent fill

Each group is one SVG path: an annular sector between an outer radius of 45 and an inner one of 29, from its start to its end as shares of the circle, counted clockwise from the top. The path has a border of 1.5 in the group's neon color and a fill of the same color at 22 percent over transparent, so the card shows through. One group holding every project is two concentric circles filled with the even-odd rule, since an arc cannot start and end at the same point. The SVG lets its drop shadow overflow its box. Each path carries `data-part` and its share in `data-share`, which the tests read.

### The tooltip lists the projects of a group that is not met

`monthlyKpiStandings` already puts each project in a group, so it also keeps the names of the projects that landed in the slightly-behind, far-behind and unrated groups, in the order of the project list. The doughnut shows them in a small card drawn through a portal with fixed coordinates, so the card's own scroll area cannot clip it. The card follows the pointer over the part. It opens as well from the legend row, which is focusable and names the card with `aria-describedby`, because the SVG has the image role and hides its parts from assistive technology. The shared warm tooltip is not used: it expects an HTML trigger, and this one is triggered from an SVG path and a legend row alike.

The number in the middle of the ring is a block laid over the whole ring. It lets pointer events through, since otherwise it would sit between the pointer and every part and the tooltip would never open from the ring itself.

### Neon colors are their own tokens

The doughnut takes its colors from `--kpi-neon-*` tokens defined for the light and the dark theme, and not from `--kpi-marker-*`, which the project list's markers also use and which keep their calm tones. Each colored segment and legend dot gets a `drop-shadow` or `box-shadow` of its own color for the glow, its size set by a token so the dark theme glows wider than the light one. The grey part stays plain.

### The widget is renamed

`KpiGauge` becomes `KpiDoughnut`, since the name now tells a different shape. Its props, `range` and `counts`, stay.

## Risks / Trade-offs

- [Four small groups can leave a very thin segment] → the legend carries every count, and a group's share is never hidden.
- [Text over an SVG can drift on odd sizes] → the SVG keeps its aspect ratio and the middle is centered with flex, so both scale from the same square.
