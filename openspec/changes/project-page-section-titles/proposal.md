## Why

The project page stacks the advertising connections, the period's figures and the campaign
table one under another with only the tasks below them titled, so a reader scanning the
page cannot tell where the connections end and the figures begin.

## What Changes

- The connections block on a project page carries a small title, Интеграции, shown only to
  members who see the block.
- The figures of the period — the summary and the campaign table — open with a small title,
  Метрики, on the row that holds the period control.
- Both titles are styled like Задачи в работе, the title already over the tasks in flight.

## Capabilities

### New Capabilities

### Modified Capabilities
- `meta-project-integration`: the connections block is titled.
- `campaign-metrics`: the project's figures are titled.

## Impact

- `apps/web/src/features/meta-integration/MetaIntegration.tsx`,
  `apps/web/src/pages/project/ProjectPage.tsx`, `apps/web/src/shared/config/ru.ts`.
- No API or schema change.
