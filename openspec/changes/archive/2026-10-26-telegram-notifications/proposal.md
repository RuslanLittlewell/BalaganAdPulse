## Why

Notifications reach a member only while the app is open. Members who connected the Telegram bot to
create tasks already have a chat with it, so the same notifications can reach them there.

## What Changes

- Every new in-app notification is also sent to the recipient's Telegram chat when they have
  connected the bot and not turned this off: the same text as in the app, the actor, the deadline
  for a due task, and a link that opens the task, project or document.
- An unread task-change notice that is refreshed by another change is not sent again.
- The Telegram section of the profile gains a «Присылать уведомления» switch, on by default.
- A failure to reach Telegram never affects the notification in the app.

## Capabilities

### New Capabilities

- `telegram-notifications`: notifications forwarded to the linked Telegram chat, and the switch.

### Modified Capabilities

None.

## Impact

- API: `telegram_link.notifications` column and migration; a `NotificationRelay` port in
  notifications; a Telegram relay and message renderer; `PATCH /api/telegram`; status carries
  `notifications`; OpenAPI.
- Web: the switch in `TelegramBotSection`, the API client and its mutation.
