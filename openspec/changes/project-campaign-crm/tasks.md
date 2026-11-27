## 1. API

- [x] 1.1 Add `campaign_crm` to `project` with its migration; return `campaignCrm` with each board; serve `PATCH /api/crm/boards/:boardKey` for members with `update` on `lead-board`, with an audit entry and OpenAPI
- [x] 1.2 Cover it with tests: the default, turning it on and off, the board list after a change, a guest refused, an unreachable board, the audit entry

## 2. Web

- [x] 2.1 Read the campaign scope from the board's `campaignCrm`; add the CRM по кампаниям switch to the right of Интеграции for members who may manage the board's columns, saving at once and rolling back with an alert on failure; remove the profile switch and its browser preference; Russian and English copy
- [x] 2.2 Cover it with tests: the switch turns the campaign select on and off, the switch hidden from a guest who still gets the select, a failed save, the Marquiz tab following the project's setting, General without the switch

## 3. Close

- [x] 3.1 Update the `marquiz-campaign-webhooks` artifacts to read the project's setting
- [x] 3.2 Run `npm test`, the web tests and the type-checks until green; `openspec validate project-campaign-crm --strict`
