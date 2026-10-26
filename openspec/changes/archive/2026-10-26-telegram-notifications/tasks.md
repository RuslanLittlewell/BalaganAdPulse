## 1. API

- [x] 1.1 Add `notifications` to `telegram_link`, read it in the status and let `PATCH /api/telegram` change it.
- [x] 1.2 Add the `NotificationRelay` port and call it with newly created notifications.
- [x] 1.3 Implement the Telegram relay and the message renderer, and wire it before notifications.

## 2. Web

- [x] 2.1 Show the «Присылать уведомления» switch for a linked bot.

## 3. Verification

- [x] 3.1 Cover the relay, the renderer, the forwarding rule, the route and the switch.
- [x] 3.2 Run the tests until green; `openspec validate telegram-notifications --strict`.
