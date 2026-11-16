## Context

The preference is stored per member in `localStorage`. Boards are projects, and a board key is the project id. Leads carry `campaignId`. `useCampaignReferences(projectId)` returns campaign names for a project.

## Decisions

- The scope is a `campaign` search parameter, not part of the stored view state. The stored view is per member and board and is pruned against fields; a campaign scope is navigation, closer to the board choice.
- `visibleLeads` and `LeadTable` take an optional `campaignId` next to the view and drop leads of other campaigns. Board, table, tasks and the count in the menu all go through them.
- A small hook reads the preference through `useSyncExternalStore`. Saving dispatches an event, so the CRM updates without a reload.
- The campaign list is the same reference list the lead card uses, so it needs no new endpoint.

## Risks

A partner member only sees one campaign; the select lists what the reference endpoint returns for them and the scope stays harmless.
