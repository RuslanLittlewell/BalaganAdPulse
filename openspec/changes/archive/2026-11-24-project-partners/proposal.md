## Why

One project often advertises for several partners of the client. Gealan runs one Meta account
for five dealer partners, with one campaign each, and every lead lands on one CRM board. Each
partner needs to see its own campaign's spend and figures and work its own leads, without seeing
the other partners, while the agency and Gealan keep working with the whole project as they do
now.

## What Changes

- A partner is a person bound to one campaign of a project. Several people may be bound to the
  same campaign. There is no separate partner record to name or manage.
- In the client's cabinet, the contact book's directory of the company's people is named
  «Сотрудники» and its add button «Добавить». The dialog offers «Сотрудник» or «Партнёр».
  «Сотрудник» invites somebody to the company as before; «Партнёр» asks for a project and then
  for a campaign of it and creates a registration link. The contact book has no Partners tab.
- The agency's admin and the client's principal (`CLIENT_ADMIN`) issue partner invitations. The
  company's people list shows partners with their campaign, and those two roles remove a partner.
- A new registration type, `PARTNER`, names the campaign. Whoever redeems it becomes a member with
  the new role `PARTNER`, bound to that campaign. Deleting the campaign ends that membership.
- A partner reaches the campaign's project only. They see the project's figures counted over
  their campaign, that campaign with its ad sets and ads, and the CRM board with that campaign's
  leads only. They create, edit and move those leads, and every lead they create names their
  campaign. They do not delete leads and do not change the board's columns or fields.
- A partner sees the contacts and organizations linked to their leads only, and nothing of the
  client's other people, projects, tasks, reports, documents, KPIs, connections or members.
- After signing in, a partner lands on their project, and the menu offers the project and CRM only.
- Agency members and the client's people see and do everything as before.
- Out of scope: sending CRM stages to Meta (CAPI), partner reports, a partner's own dashboard,
  partners inviting their own people, one partner holding several campaigns.

## Capabilities

### New Capabilities

- `project-partners`: the invitation that binds a partner to one campaign, who issues it, how
  the client's contact book offers it, and how partners are listed and removed.
- `partner-access`: what a partner's people reach, see and change: the project, the figures and
  campaigns, the CRM board and contacts, the navigation, and everything they are refused.

### Modified Capabilities

None. Agency and client behaviour does not change; the new role and registration type are
described in the new capabilities.

## Impact

- Prisma: the `PARTNER` role and registration type, `membership.campaign_id` and
  `invite.campaign_id`, both deleted with the campaign. Existing data survives.
- Access policy package: the `PARTNER` role in the permission matrix, used by API and web.
- API: actor resolution carries the partner's campaign; campaign, figure, lead, contact,
  notification and project reads narrow to it; the invites module issues and redeems partner
  invitations; client member lists include partners with their campaign; the session describes
  the partner; OpenAPI.
- Web: the client's contact book («Сотрудники», «Добавить», the staff or partner choice with
  project and campaign), partner rows with removal, the partner's navigation and landing page, the
  lead form's campaign, Russian copy in `ru.ts`.
