## Why

A task says which project it is for, but not which campaign. A media buyer's work is
mostly campaign-shaped — "rewrite the creatives on Поиск / Москва", "the Meta set is
over budget" — and the board cannot say which. Opening a campaign and asking what is
outstanding on it is impossible; so is telling two similar tasks apart when a project
runs on four channels at once.

Not every task is about a campaign, though. Setting up analytics, agreeing a budget or
writing a monthly report belongs to the project as a whole. That case has to stay easy
to express, and it has to remain the default: attaching every task to some campaign
because the form insisted would make the link meaningless.

## What Changes

- A task gains an optional campaign, which must be one of its own project's campaigns.
- No campaign means the task is about the project as a whole — shown as **Общий**.
- The task form offers a campaign select once a project is chosen, defaulting to Общий.
- Changing a task's project releases a campaign that no longer belongs to it.
- Deleting a campaign leaves its tasks standing, as Общий.
- The API gains a reference listing of a project's campaigns for the picker, separate
  from the metrics listing.

## Capabilities

### Modified Capabilities

- `task-board`: a task may name a campaign of its project, or none.
- `campaign-metrics`: a project's campaigns can be listed as references, without figures.

## Impact

- `apps/api`: `Task.campaignId` and its migration; the tasks module's ports, use cases,
  repository and HTTP schemas; a campaign-reference listing in the campaigns module.
- `apps/web`: the task entity's contracts, the task form dialog, the card, and the
  Russian strings.
- No breaking change: the field is optional everywhere and absent means what the current
  behaviour already means.
