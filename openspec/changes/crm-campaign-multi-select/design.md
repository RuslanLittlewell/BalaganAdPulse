## Context

The CRM menu column renders the campaign select with the single-choice searchable select and
keeps the choice in one `campaign` address parameter. The CRM page reads that parameter, accepts
it only for a running campaign of the board's project, and passes one `campaignId` in the view
scope to the board, the table and the tasks view. The shared multi-select already serves the
partner form and the task filters, but its all option checks every item, and an empty choice
shows the placeholder.

## Goals / Non-Goals

**Goals:**

- Scope the CRM to any set of campaigns of the board's project, of any status.
- Keep old links with one `campaign` parameter working.

**Non-Goals:**

- Remembering the campaign choice between visits outside the address.
- Filtering leads by campaign on the server.

## Decisions

- The address holds one `campaign` parameter per chosen campaign, read with `getAll`. A link
  with a single parameter reads as a choice of one, so no redirect is needed. A comma-separated
  value was rejected because it needs its own parsing and breaks the old links' shape.
- An empty choice means all campaigns. The shared multi-select gains an `emptyMeansAll` option:
  its all item is checked while nothing is chosen, picking it clears the choice, and the trigger
  shows the all label instead of the placeholder. Without the option the partner form and the
  task filters behave as before. Passing every campaign id for all was rejected: the first click
  on a campaign would uncheck it instead of choosing it, and leads without a campaign would
  disappear.
- The view scope carries `campaignIds` instead of `campaignId`. An empty list leaves the leads
  unscoped. Ids that are not campaigns of the board's project are dropped before they reach the
  scope, as the single id was.
- The campaigns are ordered running first and marked with the same running and stopped dot as
  the partner form.

## Risks / Trade-offs

- A long choice makes a long address. The trigger shows the first campaign and the count of the
  rest, so the select stays narrow in the menu column.
