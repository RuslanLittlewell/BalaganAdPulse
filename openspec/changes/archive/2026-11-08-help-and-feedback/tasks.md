## 1. API

- [x] 1.1 Add `replyTo` and `attachments` to `MailMessage`, `SmtpMailTransport` and `LogMailTransport`
- [x] 1.2 Read `SUPPORT_EMAIL` in the config and document it in `.env.example` and the README
- [x] 1.3 Add the `support` module: topics, feedback validation, email composition, contacts, ports and use cases
- [x] 1.4 Add `GET /api/support/contacts` and `POST /api/support/feedback` with multer limits, signature checks and a per-user rate limit
- [x] 1.5 Mount the support routes before the trial guard and wire the module in the container
- [x] 1.6 Document both endpoints in the OpenAPI document

## 2. Web

- [x] 2.1 Give `Sidebar` a `help` prop that renders the bottom help item, and remove the unused `footer` slot
- [x] 2.2 Add the support contacts query and the feedback mutation
- [x] 2.3 Build `HelpFeedbackDialog`: topic, message, screenshots by pick, drop and paste, sent and unavailable states, the support email on failure
- [x] 2.4 Open the dialog from `MainNav`, on desktop and in the mobile bar
- [x] 2.5 Add the Russian copy to `ru.ts`

## 3. Tests

- [x] 3.1 API tests: delivery with attachments and reply-to, context from the session, validation errors, 503 when unconfigured or failing, expired trial, client role, platform administrator, rate limit, contacts
- [x] 3.2 Web tests: menu item and collapsed name, default topic, validation, paste and removal of a screenshot, sent state and closing it, unavailable state, `mailto:` link on failure, no help block beside the form
