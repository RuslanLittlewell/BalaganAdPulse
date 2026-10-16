## 1. Zoomable hour grid

- [x] 1.1 Add failing tests: the zoom controls, their availability at each end, the level exposed
  on the grid, the remembered level per person, compact cards at the smallest level, and
  `minutesFromTop`/`topOfTime` at a non-default hour height. Run them and see them fail.
- [x] 1.2 Add the remembered zoom to `moduleMemory`, measure the calendar's visible height,
  derive the hour height per level, thread it through the grid, cards, ghost and drop maths, and
  render compact cards; add the strings.
- [x] 1.3 Run `npm run test:web` and the web build until green;
  `openspec validate task-calendar-zoom --strict`.
- [x] 1.4 Add a failing test for the assignee tooltip on a calendar card, then wrap the avatar in
  the shared tooltip.
