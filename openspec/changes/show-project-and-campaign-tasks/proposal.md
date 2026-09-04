## Why

The figures say what happened; the board says what is being done about it. They are
read in different places, so answering "this project is spending badly — is anyone on
it?" means leaving the project screen, opening the board, and filtering it by eye.

Now that a task can name a campaign, the two halves can sit together: a project's screen
can show the work in flight under it, and a campaign's screen can show the work about
that campaign. Neither screen is where work is *managed* — the board is — so what they
need is a list that can be read and opened, not one that can be edited.

## What Changes

- The project screen lists the project's tasks that are still in flight, below the
  campaigns.
- The campaign screen lists the tasks that name that campaign.
- Opening a task from either list shows it read-only in a dialog: its description as
  written, with its project, campaign, priority, responsible member and stage.
- The task listing accepts a campaign filter.

## Capabilities

### Modified Capabilities

- `task-board`: tasks can be listed for one campaign, and a task can be read without
  the controls that change it.

## Impact

- `apps/api`: a campaign filter on the task listing.
- `apps/web`: the task entity's list hook, a read-only task dialog, and the task lists
  on the project and campaign screens.
- No breaking change: the filter is optional and the board is untouched.
