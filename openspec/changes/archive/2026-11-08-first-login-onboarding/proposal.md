## Why

A new organization starts on a 14-day trial, and its admin lands on an empty dashboard
with no sign of what to do first. Most of the value appears only after a client, a project
and a connected ad account exist, and the trial runs out while the admin is still looking
around. People invited into an existing organization get no introduction either. A welcome
on the first visit and a short list of first steps in the left menu take both to the point
where the app is useful.

## What Changes

- On a member's first visit, a welcome dialog explains in two or three lines what the app gives them. The text depends on the role: admin, manager, guest or client.
- Admins and managers get a "Первые шаги" item in the left menu, above "Помощь", with their progress, for example "2 из 6". It opens a list of steps.
- An admin's steps: add a client, create a project, connect a Meta or Google ad account, invite an employee, set the KPI target, connect the Telegram bot. The employee step is left out when the tariff allows one user. The Telegram step is left out when the bot is not available to the person.
- A manager's steps: fill in the profile with a phone or a Telegram name, and connect the Telegram bot.
- A step is done when the data says so, whoever did it and wherever. Choosing a step takes the person to the place where it is done.
- The list can be hidden. It disappears on its own once every step is done.
- A project without an ad account gets a hint on the connect button.
- Members who exist when the change ships see neither the welcome nor the list.

## Capabilities

### New Capabilities
- `first-login-onboarding`: the welcome on the first visit, the first-steps list and its steps, and where the state is kept.

### Modified Capabilities
- `onboarding-hints`: a new hint points at connecting an ad account.

## Impact

- Prisma: `Membership` gains `welcomed_at` and `onboarding_hidden_at`. The migration fills both for every existing membership.
- API: a new `onboarding` module with `GET /api/onboarding`, `POST /api/onboarding/welcome` and `POST /api/onboarding/hide`, mounted before the trial guard.
- Web: a welcome dialog, a `Sidebar` prop for the first-steps item, a first-steps dialog, the contact book and the profile dialog opened from a link, a new hint, and the copy in `ru.ts`.
