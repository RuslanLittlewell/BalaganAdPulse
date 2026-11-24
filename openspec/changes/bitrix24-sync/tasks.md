## 1. Verify the portal

- [ ] 1.1 Against a real portal, confirm the REST methods, the outbound event names, the event payload and the field names this change relies on, and note any difference in `design.md`

## 2. Data and permission

- [x] 2.1 Add the `bitrix24` tables and their migration
- [x] 2.2 Add the `bitrix24-connection` resource to the access matrix, with ADMIN only
- [x] 2.3 Test the matrix rows and the migration

## 3. Connection

- [x] 3.1 Create the `bitrix24` module with the REST client, the safe address check, the sealed storage and the connection use cases
- [x] 3.2 Add the connection endpoints with their schemas and OpenAPI entries
- [x] 3.3 Test connecting, refused addresses, secrets never returned, roles, the CRM module gate, switching off and removing

## 4. Inbound webhook

- [x] 4.1 Add the public route, the key and token check, the rate limit and the inbox
- [x] 4.2 Add the inbox worker that fetches and applies records through the CRM use cases
- [x] 4.3 Test valid, wrong token, unknown key, rate limit and ignored events for a switched-off connection

## 5. Outbound sync

- [x] 5.1 Add the change scan and the worker with pacing, retries and failure states
- [x] 5.2 Map leads and stages, with the settings that hold the mapping and the inbound project
- [x] 5.3 Sync contacts and companies
- [x] 5.4 Sync notes and comments
- [x] 5.5 Sync lead tasks, assignees and completion
- [x] 5.6 Apply the last-change-wins rule and echo recognition
- [x] 5.7 Test each entity both ways, conflicts, echoes, no deletion across systems, a down portal, a refused change and a revoked webhook

## 6. Backfill and trial

- [x] 6.1 Add the one-time upload and download runs with progress and the single-run rule
- [x] 6.2 Apply the live-organization filter to the outbox and inbox claims
- [x] 6.3 Test both runs, the refusal of a second run and the paused organization

## 7. Web

- [x] 7.1 Add dictionary keys to `ru.ts` and `en.ts`
- [x] 7.2 Replace the «Web интеграция» button with «Интеграции +», coloured like «Добавить лид», opening a dialog with the tabs «Web интеграция» and «Битрикс24»; move the existing web integration dialog body into the first tab unchanged
- [x] 7.3 Build the «Битрикс24» tab like the web integration: connection form, status, address to call, mapping, inbound project, skipped and failed lists, upload and download, switching off and removing with confirmation
- [x] 7.4 Test the button for admins and managers and its absence for guests and clients, the tabs, the missing tab bar for a manager, the no-project message, the unchanged web integration tab, error states and the confirmations

## 8. Verify

- [x] 8.1 Run `npm test` and the web suite
- [ ] 8.2 Walk the flow against a test portal: connect, create a lead on each side, move it, comment, add a task, and see each arrive

## 9. Audit fixes

- [x] 9.1 Connect to the portal through a lookup that refuses private addresses on the connection itself, and refuse addresses with a port
- [x] 9.2 Limit refused webhook events per network address
- [x] 9.3 Drop a Bitrix24 website that is not an http or https address
- [x] 9.4 Test the pinned lookup, the port refusal, the refusal limit and the website check

## 10. Matching

- [x] 10.1 Add the key functions `phoneKey`, `emailKey`, `nameKey` and `hostKey` and the contact, company and lead match rules to the domain, with unit tests for the formats in the spec scenarios
- [x] 10.2 Add store lookups for unlinked candidates in the same client or project, oldest first and never linked, and add a `linked` counter to `Bitrix24Run` with one migration
- [x] 10.3 Look for a match before creating in `pullRecord` and `ensureRecord`, and link instead of creating; count a link as `linked` in the download run
- [x] 10.4 Add the portal lookups with `crm.duplicate.findbycomm`, `crm.company.list` and `crm.lead.list`, and look before `crm.<entity>.add` in `pushRecord`; count a link as `linked` in the upload run
- [x] 10.5 Test each rule both ways against the fake portal: phone and email formats, company by name and by host, a lead with and without a matching contact, several matches, a record taken elsewhere, a live event, the download and the upload, and that linking sends no contents
- [x] 10.6 Show the three counts in the run line, remove the duplicate warning from the upload and download confirmations in `ru.ts` and `en.ts`, and update the web tests
