## 1. Store several connections

- [x] 1.1 Migrate `project_integration` to its own id, `provider`, `leads_enabled`, unique `(project_id, account_id)`; add and back-fill `campaign.source_account_id`; regenerate Prisma.
- [x] 1.2 Rework the integration repository, import job and lead-poll job to address a connection by id; set the campaign's source account on import; filter lead sweeps by it; skip connections with lead import off.
- [x] 1.3 Rework the use cases and routes: list, add Meta (409 on duplicate, currency rule across connections), replace credentials, set `leadsEnabled`, refresh and disconnect by id; previews and creatives pick the connection of the ad's account.
- [x] 1.4 Update and add API tests: two accounts in one project, duplicate 409, other currency refused, disconnecting one keeps the other, lead switch stops and resumes polling, sweeps and previews use the right account.

## 2. Web

- [x] 2.1 Render one Meta panel per connection, unchanged in look, with refresh and settings; put the lead switch in the settings window (on by default for a new connection); add the dashed "+" and the provider window (Meta selectable; Google, Yandex, TikTok, GPT not yet available).
- [x] 2.2 Expose the campaign source account from the API; above the campaign table show tabs Все and one per account when there is more than one, filtering rows and dropping totals for an account tab.
- [x] 2.3 Add web tests: panels per connection, the provider window and its disabled entries, adding a connection, the lead switch, no "+" without permission, tabs only with more than one account and filtering by account.
- [x] 2.4 Run `npm test` and `npm run test:web` until green; `openspec validate multiple-project-integrations --strict`.
