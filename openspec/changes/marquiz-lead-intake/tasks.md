## 1. API

- [x] 1.1 Map a Marquiz webhook body to a website lead: contacts, answers with several options, the required mark, the quiz name, UTM tags with the `name` fallback, page and referrer, length limits, and the content-based submission id
- [x] 1.2 Serve `POST /api/intake/marquiz/:key` in the website intake router: JSON body under the size cap, key check, per-key limit, server-to-server delivery whatever the allowed sites, 200 on success, and its OpenAPI entry
- [x] 1.3 Cover the mapping and the endpoint with tests: a submission, the campaign link, a repeated delivery, no allowed sites, a rotated key, a body that is not a submission, and the per-key limit

## 2. Web

- [x] 2.1 Add a Marquiz tab to the CRM integrations window that shows the webhook address with a copy button, the quiz editor instruction and the key note, and creates the key when there is none, with Russian and English copy
- [x] 2.2 Cover the Marquiz tab with tests

## 3. Close

- [x] 3.1 Run `npm test`, the web tests and the type-checks until green; `openspec validate marquiz-lead-intake --strict`
- [ ] 3.2 After deployment, paste the address into the Window Hub quiz, send a test submission and check the lead on the board
