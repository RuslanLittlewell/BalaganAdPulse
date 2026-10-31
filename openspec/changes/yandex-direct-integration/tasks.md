## 1. Storage and core

- [ ] 1.1 Prisma: rename the pending sign-in table to `oauth_sign_in` with a `provider` column and a provider-neutral credential column, with a migration; move Google onto it unchanged
- [ ] 1.2 Add `YANDEX` to the integration providers and the OpenAPI enum
- [ ] 1.3 Let a snapshot source renew its credential before the snapshot, and store the renewed credential through the job under its lease

## 2. Yandex client

- [ ] 2.1 Yandex OAuth: authorize URL, code exchange, renewal, configuration check and sandbox switch
- [ ] 2.2 Direct client: JSON calls with `Client-Login`, error classification, paging by `LimitedBy`
- [ ] 2.3 Accounts: the advertiser's own account or the agency's active clients, login normalisation, currency, refusal of conventional units
- [ ] 2.4 Reports: three levels, TSV by column header, micros, `--` as zero, VAT excluded, report names, waiting within the budget
- [ ] 2.5 Hierarchy: campaigns (archived only with figures), ad groups and ads by campaign, statuses, names, objective
- [ ] 2.6 Creatives: ads by type, images by hash, video extensions and builder creatives
- [ ] 2.7 Cover the OAuth client, the Direct client, the reports, the hierarchy and the creatives with recorded responses

## 3. Use cases and routes

- [ ] 3.1 Yandex start, callback, accounts and connect use cases on the shared sign-in record, with renewal of the sign-in on an existing connection
- [ ] 3.2 Routes, the callback router, wiring and OpenAPI
- [ ] 3.3 Read creatives from Direct for Yandex connections in the creative use case
- [ ] 3.4 Report `YANDEX` campaigns, ad groups and ads as the type conversions
- [ ] 3.5 Cover the sign-in rules, the connection, the import, renewal, the revoked path and result typing with tests

## 4. Web

- [ ] 4.1 Make Yandex selectable in the provider window and start sign-in from it
- [ ] 4.2 Share the account choice and the connection panel between Google and Yandex; the Yandex panel titled by the Я mark and Яндекс Директ; the sign-in-again prompt
- [ ] 4.3 Name the Yandex tabs `Яндекс · account`
- [ ] 4.4 Russian copy and tests

## 5. Configuration and close

- [ ] 5.1 Document the Yandex variables in `.env.example`, docker compose and the README, with the steps to register the OAuth application and request API access
- [ ] 5.2 Run `npm test`, the web tests and the type-checks until green; `openspec validate yandex-direct-integration --strict`
