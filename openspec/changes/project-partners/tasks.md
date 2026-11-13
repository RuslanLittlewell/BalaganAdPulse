## 1. Data and permissions

- [x] 1.1 Prisma: the `PARTNER` role and registration type, `membership.campaign_id` and `invite.campaign_id` deleted with the campaign, with a migration
- [x] 1.2 Access policy: `PARTNER` in `ROLES` and the matrix, the `lead-board` and `partner` resources; switch column and field use cases from `lead` to `lead-board`
- [x] 1.3 Cover the matrix and the column and field permissions for every role with tests; `npm test` and `npm run test:web` green

## 2. Partner invitations and people

- [x] 2.1 Invites: a `PARTNER` invitation names a campaign the issuer reaches, carries the campaign's client, and is issued by `ADMIN` and `CLIENT_ADMIN` only
- [x] 2.2 Redemption enrols a `PARTNER` membership bound to the campaign through the invites module's code, expiry, email binding and transaction
- [x] 2.3 Client member lists include partners with their campaign, narrowed by project; a `CLIENT_ADMIN` removes only people of their clients
- [x] 2.4 Remove the partner record, its module, routes and OpenAPI
- [x] 2.5 Cover issuing, who may issue, another client's principal, invalid bodies, redemption and its failure, email binding, expiry, revocation, listing, removal and campaign deletion with tests; `npm test` and `npm run test:web` green

## 3. Partner reach

- [x] 3.1 Actor resolution loads the partner's campaign and project onto `ActorContext.partner`; a partner membership without a campaign resolves to no actor
- [x] 3.2 Shared filters `reachableProjects`, `reachableCampaigns`, `visibleLeads`, `visibleRecords`, used by the project, campaign, metric, lead, CRM record and notification repositories
- [x] 3.3 Lead rules for partners: the partner's campaign on create and edit, filled in when missing, assignees bound to the same campaign, no delete
- [x] 3.4 Session: the role, the partner's campaign and project, and the `PROJECTS` and `CRM` modules only; module guards for the rest
- [x] 3.5 Cover with tests: figures over the partner's campaign, the board and counts over its leads, contacts of its leads, another campaign's lead, campaign and project answered not found, every GET route the API serves called as a partner, and agency and client results unchanged; `npm test` and `npm run test:web` green

## 4. Web

- [x] 4.1 The role in `useCan`, the partner's menu and start route
- [x] 4.2 The project page for a partner: no connections, KPI settings, documents, reports, share link or activity log
- [x] 4.3 The lead form preselects the partner's campaign; no delete control and no column or field management for a partner
- [x] 4.4 The client's contact book: the company tab named «Сотрудники», the «Добавить» button, no Partners tab; the dialog's «Сотрудник» or «Партнёр» choice with a project and then a campaign for a partner, each campaign marked green or red, and the «Активные кампании» switch on by default; the campaign names list carries `status`
- [x] 4.5 Partner rows in the company's people with the campaign name and removal with confirmation; the CRM assignee picker limited to the board project's people
- [x] 4.6 Russian copy in `ru.ts`, with the partner management copy removed
- [x] 4.7 Cover with tests: the partner's menu, landing and project page, the lead form's campaign, the customer's directory name and button, the staff and partner choice, the project and campaign selection, the campaign marks and the switch, the missing campaign, partner rows and their removal; `npm test` and `npm run test:web` green

## 5. Close

- [x] 5.1 Describe partners in the README: who invites them, what a partner sees, how to remove one
- [x] 5.2 Run `npm test`, `npm run test:web` and the type-checks until green; `openspec validate project-partners --strict`
