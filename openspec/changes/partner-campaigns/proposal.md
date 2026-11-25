## Why

A partner is bound to exactly one campaign. A dealer who works the leads of three campaigns of a
project needs three accounts today, and the agency has no way to give a partner the campaigns of
one advertising account at once. When a partner is invited, the person inviting should pick the
advertising accounts and the campaigns the partner will see.

## What Changes

- **BREAKING** A partner invitation names one or more campaigns of one project instead of one
  campaign. The invitation API takes `campaignIds` in place of `campaignId`, and the session
  describes a partner by `campaignIds` and `projectId`.
- The partner form in the contact book asks for the project, then offers a multi-select of the
  project's advertising accounts, which narrows the campaign list, and a multi-select of
  campaigns. At least one campaign is required.
- A partner reaches the figures, campaigns, CRM leads and contacts of all their campaigns, still
  within the one project.
- A lead a partner creates names one of their campaigns: the only one, or the one the partner
  picks. A partner may move a lead between their own campaigns, and assigns leads to partners who
  share one of their campaigns.
- The contact book lists a partner with the names of all their campaigns.
- A campaign deleted with its project is taken from its partners; a partner left with none can no
  longer sign in.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `project-partners`: a partner invitation names several campaigns, chosen through advertising
  accounts and campaigns in the contact book; partners are listed with their campaigns.
- `partner-access`: a partner reaches every campaign they hold, and their leads, figures and
  session cover all of them.

## Impact

- Prisma: tables `partner_campaign` and `invite_campaign` replace the `campaign_id` columns of
  `membership` and `invite`, with existing bindings copied over.
- API: invitations, enrolment, the membership directory and actor, partner reach for campaigns
  and leads, lead creation and assignment, the members list, the session, the campaign names
  list (which gains the advertising account), OpenAPI.
- Web: the partner form in the invitation dialog, the session type, the contact book's partner
  label, Russian and English copy.
