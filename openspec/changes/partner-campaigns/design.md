## Context

`membership.campaign_id` and `invite.campaign_id` bind a partner and a partner invitation to one
campaign, with `ON DELETE CASCADE` from the campaign. The actor carries
`partner: { campaignId, projectId }`, resolved by `partnerForMembership` for each request and for
notifications. Partner reach is concentrated in `partner-reach.ts`: `reachableCampaigns` and
`visibleLeads` filter by the one campaign, and the project reach filters by its project. Lead
creation and update force or check that campaign in `lead-use-cases.ts`, and the board's assignee
list matches partners by it. The members directory selects the campaign to label a partner in the
contact book. Campaigns are only ever deleted with their project.

A campaign imported from an advertising platform carries its `channel` and `source_account_id`. A
campaign added by hand has a channel and no account. `ProjectIntegration` holds the account IDs of
a project's connections but no account names, and its read endpoint is closed to `CLIENT_ADMIN`,
who invites partners.

## Goals / Non-Goals

**Goals:**

- Bind a partner and a partner invitation to any number of campaigns of one project.
- Let the person inviting narrow the campaigns by advertising account.

**Non-Goals:**

- Partners across several projects.
- Giving a partner an advertising account as such, so that campaigns created later reach them.
  The account choice only narrows the campaign list.
- Changing the campaigns of an existing partner. A partner is removed and invited again.

## Decisions

- **Join tables, not arrays.** `partner_campaign (membership_id, campaign_id)` and
  `invite_campaign (invite_id, campaign_id)` replace the two columns, with composite primary keys
  and `ON DELETE CASCADE` on both sides. A deleted campaign leaves its partners and invitations
  with the rest of their campaigns, and the existing rule that a partner bound to no campaign is no
  membership ends the access of a partner left with none; an invitation left with none is refused
  on redemption and when its link is opened. Deleting a project deletes the partners and partner
  invitations bound to its campaigns in the same transaction, as the old cascade did, and the
  members list leaves out a partner bound to no campaign. A `uuid[]` column was considered and rejected: it has no foreign key, so a deleted
  campaign would stay in it.
- **The actor lists the campaigns.** `partner` becomes `{ campaignIds, projectId }`.
  `partnerForMembership` reads the membership's campaigns within the organization, takes the
  project of the first and keeps only the campaigns of that project, so a binding that somehow
  spans two projects never widens reach. The reach helpers filter with `in`, which keeps every
  query that already uses them correct without further change.
- **One project per invitation.** The invitation API takes `campaignIds` (one to 100, distinct). Each
  campaign must be reachable by the issuer, or the request is answered as not found; campaigns of
  two projects are refused as invalid. Redemption copies the invitation's campaigns to the new
  membership in the same transaction.
- **Leads keep one campaign.** On create, a partner's lead takes the requested campaign, which must
  be one of theirs; with none requested it takes the partner's only campaign, and a partner with
  several is asked to choose. On update, a requested campaign must be one of theirs. The web
  lead form already shows a campaign picker to partners, fed by the campaigns the
  partner reaches. Assignees are the active partners of the board who share at least one campaign
  with the acting partner.
- **Accounts come from the campaigns.** The project's campaign names list gains `accountId`, the
  campaign's source account or null. The invitation form groups the project's campaigns by channel
  and account into account options labelled `Meta · 1218006392621422`, plus «Добавлены вручную»
  for campaigns without an account. All accounts start chosen. Reading accounts from
  `ProjectIntegration` was rejected because it is closed to the client admin and holds no names
  either, and it would show connected accounts that have no campaigns.
- **Member records carry campaigns.** A member record exposes `campaigns: [{ id, name, projectId }]`
  in place of `campaign`; the contact book labels a partner «Партнёр · » followed by the campaign
  names joined by commas. The session exposes `partner: { campaignIds, projectId }`.

## Risks / Trade-offs

- [Changing the API shape of invitations, members and the session] → The web ships in the same
  change; no other client uses these endpoints.
- [A partner with many campaigns makes `IN` lists longer] → Partners are bound to a handful of
  campaigns of one project; the lists stay small.

## Migration Plan

1. One migration creates `partner_campaign` and `invite_campaign` with their keys, indexes and
   foreign keys, copies every non-null `membership.campaign_id` and `invite.campaign_id` into
   them, then drops the two columns with their indexes and foreign keys. Existing partners and
   pending partner invitations keep their one campaign.
2. Deploy the API and the web together.
3. Rollback: restore the columns from the join tables, taking one campaign per membership and
   invitation, before running an older build.
