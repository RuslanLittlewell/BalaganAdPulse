## 1. API

- [x] 1.1 Serve `POST /api/intake/marquiz/:key/:campaignId` beside the project address, pass the campaign to the intake, link the lead to the campaign when the key's project holds it and fall back to `utm_campaign` otherwise, and describe the address in OpenAPI
- [x] 1.2 Cover it with tests: a campaign address that overrides `utm_campaign`, a submission without tags, a removed campaign, a campaign of another project, and one lead for the same submission at both addresses

## 2. Web

- [x] 2.1 Give the Marquiz panel a campaign mode: a searchable campaign select with running campaigns first, the campaign address once one is chosen, a message when the project has no campaigns; pass the project's CRM by campaign setting and the single menu campaign from the integrations window; Russian and English copy
- [x] 2.2 Cover the campaign mode with tests: choosing a campaign, the campaign preselected from the menu, a project without campaigns, and the project address with the setting off

## 3. Close

- [x] 3.1 Run `npm test`, the web tests and the type-checks until green; `openspec validate marquiz-campaign-webhooks --strict`
