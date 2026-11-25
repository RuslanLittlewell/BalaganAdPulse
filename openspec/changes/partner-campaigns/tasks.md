## 1. Data

- [x] 1.1 Replace `membership.campaign_id` and `invite.campaign_id` with `partner_campaign` and `invite_campaign` in the Prisma models and a migration that copies the existing bindings

## 2. API

- [x] 2.1 Resolve the partner actor as `{ campaignIds, projectId }`, filter campaigns and leads by the partner's campaigns, and describe the partner by `campaignIds` in the session
- [x] 2.2 Let a partner create and move leads within their campaigns, ask for a campaign when they hold several, and assign leads to partners who share a campaign
- [x] 2.3 Take `campaignIds` in partner invitations, check reach and one project, store them, and bind the new membership to all of them on redemption
- [x] 2.4 List partners with their campaigns in the members directory and its OpenAPI, and add `accountId` to the project's campaign names
- [x] 2.5 Cover the migration, reach, figures, leads, assignment, invitations, redemption, listing and a deleted campaign with tests

## 3. Web

- [x] 3.1 Offer the project's advertising accounts and campaigns as multi-selects in the partner form, with the running-only switch, and send `campaignIds`
- [x] 3.2 Read the partner's `campaignIds` from the session and label partners with all their campaigns in the contact book, with Russian and English copy
- [x] 3.3 Cover the partner form and the contact book label with tests

## 4. Close

- [x] 4.1 Run `npm test`, the web tests and the type-checks until green; `openspec validate partner-campaigns --strict`
