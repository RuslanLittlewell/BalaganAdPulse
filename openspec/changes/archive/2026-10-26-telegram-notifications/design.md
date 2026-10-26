## Decisions

- **A port in notifications, an adapter in the bot.** Notifications gains `NotificationRelay`,
  called with the notifications `notify` has just created, after they are published to the app.
  The telegram-bot module implements it, so notifications knows nothing of Telegram. The relay is
  built before notifications in composition, since it needs only the links and the Telegram client.
- **Only new notifications.** `refreshUnread` bumps a task-change notice that is still unread;
  forwarding it again would repeat the chat message on every edit.
- **Detached and isolated.** `forward` returns at once; the adapter sends one message per
  notification and keeps going when one fails (a member who blocked the bot), reporting the
  failures through `runDetached`.
- **The same words and links as the app.** The renderer mirrors the web's notification text and
  targets: a document opens in its project, a task at `/tasks?task=<id>`, a project at its page.
  Without `APP_URL` the message carries no link.
- **On by default.** `telegram_link.notifications` defaults to true, so members who already linked
  the bot start receiving notifications; a new link starts on too.
