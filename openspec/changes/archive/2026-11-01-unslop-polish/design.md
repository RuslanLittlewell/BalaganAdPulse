## Context

Tailwind v4 computes every spacing and sizing utility from `--spacing`, which `tokens.css` sets
to `0.2rem`. A stand with the real app and seeded data measured 679 of 718 spacing values off the
4px grid on the dashboard, 755 of 857 on a project page and 394 of 460 on the task board. The
audit and the polish direction were agreed with the user: keep the brand colors, Montserrat and
the layout, and fix what the audit found.

## Goals / Non-Goals

**Goals:**

- Every spacing and size on the 4px grid, with the density the app has today.
- Quiet chrome, so that the KPI gauge, the KPI tile and the KPI marker carry the color.

**Non-Goals:**

- New palettes, fonts or layouts.
- Changes to the report PDF, which has its own design.
- Content formatting inside rich text, where bold headings and italics belong to the author.

## Decisions

- **One codemod for the grid.** A script rewrites each spacing or size utility whose value is a
  number. It reads the value at 3.2px a step, rounds it to the nearest multiple of 4px and writes
  the new step at 4px. Values at 2px and below keep their step, so `0.5` stays a 2px nudge. The
  script covers every variant and negative form, such as `md:px-4` and `-mt-1`, and the classes
  of the vendored `shared/ui/ui` components, since they render at the same scale. The utilities
  it covers:
  - padding, margin, gap and space;
  - width, height, size, the min and max sizes and basis;
  - inset, top, right, bottom and left;
  - translate, scroll margin and scroll padding;
  - indent and leading.

  Rewriting the step alone was rejected, because it would make the whole app 25% larger.
  Rounding to 2px was rejected, because the user chose the 4px grid.
- **Rounding collapses neighbours.** At 3.2px a step, `2`, `2.5` and `3` give 6.4, 8 and 9.6px,
  and all three become 8px. Spacing that told two things apart only by 1.6px loses that, and the
  render check looks for places where it mattered.
- **The calendar cell** in the vendored calendar uses `--spacing(8)`, 25.6px, and becomes
  `--spacing(6)`, 24px.
- **Labels and weights.** `uppercase` and wide `tracking-*` leave the interface labels. The words
  stay as they are written in `ru.ts`, which already uses sentence case. `font-bold` becomes
  `font-semibold` for headings and the logo.
- **Glass and glow.** The shell keeps its rounded panels, hairline border, translucency and
  `backdrop-blur-3xl`, and loses `shadow-2xl`. The sticky first column of the performance tables
  blurs what lies beneath it. With the shell's blur and translucency, the figures that scroll
  under that column stay faintly visible. Without them, Chrome blurs the figures out completely,
  and the user asked to keep the scrolling as it was. `AddTile` keeps its dashed border and plus,
  as the summary-tiles and integration specs require, and drops `BorderGlow` and the hover scale.
- **Color on cards.** The priority badge keeps its words and takes a muted surface, with Высокий
  in amber and Срочный in the destructive text color. Task cards keep the priority stripe, as the
  user asked. The stage stripe on lead cards goes. The KPI markers on projects and campaigns stay,
  as their specs require.

## Risks / Trade-offs

- [The codemod touches hundreds of class lists at once] → Style-only, so the behaviour tests
  catch nothing it breaks. The render check covers the dashboard, a project, the task board, the
  task form and CRM in both themes, and at phone width, before the change is done.
- [Collapsed neighbours read as a mistake somewhere] → Fix by hand where the render shows it.
