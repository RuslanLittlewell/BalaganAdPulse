## Why

People who use AdPulse have no way to reach support from inside the app. A problem gets
reported in a private chat without the page, the browser or a screenshot, and an idea or
a question about the tariff gets lost. A help and feedback dialog in the left menu gives
every member one place to write to support and to find its address.

## What Changes

- Add a "Помощь" item at the bottom of the organization's left menu. It opens one dialog for every member, whatever the role.
- The dialog holds a feedback form with a topic, a message and up to three screenshots. The topics are: "Сообщить о проблеме" (the default), "Предложить улучшение", "Вопрос по работе сервиса", "Тариф и оплата", "Подключение рекламных кабинетов" and "Другое".
- The form adds technical context on its own: the page, the browser, the screen size, the organization, the person, their role and the tariff. It shows the person what will be sent.
- Feedback goes out as one email to the support address through the existing SMTP transport. Screenshots are attachments, and a reply goes straight to the sender. Nothing is stored in the database.
- Sending feedback works on an expired trial, since the people on one are the ones most likely to write about the tariff.
- The dialog also shows the support email and a button that shows the closed onboarding hints again.
- A new environment variable, `SUPPORT_EMAIL`, sets the support address. In production it is `balagan.ads@gmail.com`.

## Capabilities

### New Capabilities
- `help-and-feedback`: the help item in the left menu, the dialog, the feedback form and its delivery by email, and the support address.

### Modified Capabilities
- `onboarding-hints`: a member can bring back the hints they have closed.

## Impact

- API: a new `support` module with `GET /api/support/contacts` and `POST /api/support/feedback` (multipart). The mail transport learns attachments and a reply-to address. The support routes are mounted before the trial guard.
- Configuration: `SUPPORT_EMAIL` in `.env.example`, the production `.env` and the README.
- Web: the shared `Sidebar` gains a help button driven by props, `MainNav` opens the new dialog, the hint memory gains a reset, and the copy goes into `ru.ts`.
- No database change.
