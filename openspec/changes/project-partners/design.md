## Context

Reach is computed in one place per kind of record. `reachableProjects(actor)` in
`shared/infrastructure/project-reach.ts` narrows projects, and every module that lists projects,
leads, contacts, tasks or notifications builds on it. Campaigns are read through
`findReachable`, `listReachableByProject` and `listReachable` of the campaign repository, and
project figures are computed over the campaigns those return. The CRM board reads leads through
`PrismaLeadRepository` and contacts through `PrismaCrmRecordRepository`, both scoped by project
reach. Public share links already narrow an actor: `ActorContext.sharedProjectId` limits reach
to one project, which is the precedent for narrowing by partner.

Permissions come from one matrix in `@adpulse/access-policy`, used by the API and by `useCan` in
the web app. Board columns and fields are guarded by the `lead` resource today, so any role that
may update leads may also reshape the board.

Invitations carry a registration type (`CLIENT`, `EMPLOYEE`, `CLIENT_STAFF`), and redemption
creates the account and membership in one transaction. Removing a member deletes the membership.
The tariff's user limit counts every active membership and every open invitation.

## Goals / Non-Goals

**Goals:**

- One filter per kind of record decides what a partner sees, so a new screen that reads through
  the existing repositories is narrowed without knowing about partners.
- Agency and client code paths do not change their results.

**Non-Goals:**

- Partner-specific screens. A partner uses the same project page and CRM as everyone, with less
  in them.
- Partners inviting or managing their own people.
- A partner record with a name, or one partner holding several campaigns.
- Hiding the campaign names of other partners from the agency and the client.

## Decisions

- **Data.** `membership.campaign_id` and `invite.campaign_id`, both nullable, both deleted with
  the campaign, plus the role `PARTNER` and the registration type `PARTNER`. A partner is a
  `PARTNER` membership bound to one campaign; several memberships may share a campaign.
  Alternatives considered: a `partner` record holding several campaigns, which the first version
  built and the client found heavier than the job needs, since every partner advertises through
  one campaign; and a partner as a client access grant on a project, which cannot express campaign
  scope.

- **Actor.** Actor resolution loads, for a `PARTNER` membership, its campaign and that campaign's
  project, and puts them on `ActorContext.partner` (`{ campaignId, projectId }`). A `PARTNER`
  membership without a campaign resolves to no actor, so the request is unauthorized. The extra
  query runs only for partners.

- **Narrowing.** Four shared filters in `shared/infrastructure`:
  - `reachableProjects`: for a partner, the campaign's project and nothing else;
  - `reachableCampaigns`: for a partner, `id = campaignId`; for others, the campaigns of
    reachable projects as now. The campaign repository's three reach methods use it, and ad set
    and ad reads already go through their campaign;
  - `visibleLeads`: for a partner, `campaign_id = campaignId`; for others, no extra condition.
    Lead lists, stage counts, board stage counts, `leadOnBoard`, activity, notes and files use it;
  - `visibleRecords`: for a partner, people and organizations with a lead matching
    `visibleLeads`; for others, the client's records as now.
  Notifications about a lead use `visibleLeads` through the lead relation.

- **Permissions.** `PARTNER` joins `ROLES`. In the matrix it may read `project`,
  `project-summary` and `campaign`, and read, create and update `lead`. It has nothing else,
  including `kpi`, `task`, `report`, `integration`, `audit`, `client`, `member` and
  `project-document`. A new resource `lead-board` guards columns and fields: read for everyone,
  create, update and delete for `ADMIN`, `MANAGER`, `CLIENT` and `CLIENT_ADMIN`, which is today's
  rule. The column and field use cases switch from `lead` to `lead-board`. A new resource
  `partner` decides who invites and removes partners: `ADMIN` and `CLIENT_ADMIN`, with the campaign
  reach check limiting a `CLIENT_ADMIN` to their own client's campaigns.

- **Lead rules for partners.** A lead a partner creates without a campaign takes the partner's
  campaign, and any other campaign is refused with 403, on create and on edit; clearing the
  campaign puts the partner's back. The assignee check accepts, for a partner, only partners of the
  same campaign, and for everyone else also the partners of the board's project. Moving and
  editing a lead the partner does not see answer 404 because the board list the mutation reads is
  already narrowed.

- **Modules.** `requireModule` and the session expose `PROJECTS` and, when the tariff has it,
  `CRM` to a partner; `DASHBOARD`, `TASKS` and `REPORTS` are not offered and their routes answer
  403. The session gains `partner: { campaignId, projectId } | null`.

- **Invitations.** `POST /api/invites` accepts `{ registrationType: "PARTNER", campaignId }`. The
  use case requires the `partner` permission, finds the campaign through `reachableCampaigns`, and
  stores the campaign's client on the invitation so the existing revoke and reach rules apply.
  Redemption enrols the membership with `campaign_id` in the same transaction as the account.

- **People.** `GET /api/members?clientId=` also returns `PARTNER` memberships whose campaign
  belongs to a project of the client, narrowed to one project when `projectId` is given, and
  every member carries `campaign: { id, name, projectId } | null`. `DELETE /api/members/:id`
  removes a partner; for a `CLIENT_ADMIN` it now requires the member to be among the people of
  their clients, which also closes removal of members outside them.

- **Web.** `useCan` and the menu read the new role. A partner's start route is
  `/projects/:projectId` from the session. The project page hides blocks by permission. In the
  customer's contact book the company tab is labelled «Сотрудники» and its button «Добавить». The
  invitation dialog for joining a client gains a «Сотрудник» or «Партнёр» choice for those who may
  invite partners; the partner form selects one of the client's projects and then one of its
  campaigns from the campaign names list, and sends the partner invitation. The campaign names
  list gains each campaign's `status`, so the form marks running campaigns (active or learning)
  green and the rest red, and its «Активные кампании» switch, on by default, hides the rest. Partner rows in the
  company's people list show «Партнёр · campaign» and a remove control with confirmation. The CRM
  assignee picker asks for the board project's people, so partners of other projects are not
  offered. The lead form preselects the partner's campaign.

- **Tariff.** Partners count toward the user limit like any member, since they hold memberships
  of the organization.

## Risks / Trade-offs

- [A read path that does not go through the shared filters leaks other partners' data] → Tests
  call every GET route the API serves as a partner, in the style of the shared-link test, and
  assert that nothing outside the partner's campaigns and leads is returned and that the routes
  outside the partner's matrix are refused.
- [Realtime board events tell a partner that the board changed when another partner's lead
  moved] → The event carries no lead data; the partner's client refetches a narrowed list. Lead
  specific events for leads the partner does not see are not delivered.
- [The campaign names of all partners appear in the agency's and the client's views] → Intended:
  the agency and the client see everything.
- [Partners count toward the user limit and may push a client over its tariff] → Shown in the
  tariff usage as now; the limit can be raised per organization.

## Migration Plan

One migration adds the `PARTNER` values to the `role` and `registration_type` enums and adds the
nullable `campaign_id`, with an index and a cascading foreign key, to `membership` and `invite`. No
existing row changes, and agency and client access behaves as before. Rolling back means deploying
the previous version after removing partner memberships and invitations, since a membership with
the `PARTNER` role cannot exist under the old enum.
