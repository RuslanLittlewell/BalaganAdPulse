## Context

Onboarding today is a handful of hints kept in the browser per user (`useHintMemory`).
Nothing records whether a member has seen the app before. The left menu is `MainNav` on the
shared `Sidebar`, which already renders the "Помощь" item from props. The contact book and
the profile dialog are opened by local state in `AppHeader`. The Telegram bot decides per
member whether it is offered (`GET /api/telegram` returns `available`). The trial guard
refuses writes once a trial has ended.

## Goals / Non-Goals

**Goals**
- A first-visit welcome per membership, remembered on the server.
- A short list of first steps whose state comes from data, so nothing has to be ticked.

**Non-Goals**
- A guided tour that highlights controls one after another.
- Demo data in a new organization.
- Onboarding progress for the platform administrator.

## Decisions

- **State on the membership.** `Membership` gains `welcomedAt DateTime?` and `onboardingHiddenAt DateTime?`. The migration sets both to the migration time for every existing row, so current members see nothing new. A membership created later starts with both null.
- **Steps are computed, not stored.** A new `onboarding` module reads counts in one round of queries: clients, projects and integrations of the organization, other staff memberships and pending employee invitations, the organization's KPI target, the person's Telegram link, phone and Telegram name. The role picks the step list; the tariff's user limit and the Telegram availability prune it. The domain holds the step catalogue and the pruning as pure functions, tested without a database.
- **Telegram availability.** The onboarding module asks through a port, implemented in the composition from the same facts the Telegram bot module uses: bot configured, role allowed, tariff with Tasks. It does not import the bot module's internals.
- **Endpoints before the trial guard.** `GET /api/onboarding`, `POST /api/onboarding/welcome` and `POST /api/onboarding/hide` mount at `/api/onboarding` after actor resolution and before the trial guard, like support. Both POSTs are idempotent: a second call keeps the first time.
- **Freshness in the web app.** The onboarding query refetches every 60 seconds while the window is focused, and the onboarding feature subscribes to the React Query mutation cache and invalidates its query after any successful mutation. A client created anywhere ticks the step without the creating code knowing about onboarding.
- **Welcome.** `features/onboarding` holds `WelcomeDialog`, rendered by the organization area of `App` once the onboarding query says `welcomed: false`. Any close posts `welcome`. For an admin or manager with steps left, the main button also opens the first-steps dialog.
- **Menu item from props.** `Sidebar` gets `firstSteps?: { label, done, total, collapsed, onOpen }`, rendered as a nav-style button with a "2 из 6" counter in the bottom region above "Помощь", hidden below the `md` breakpoint. `MainNav` owns the open state and renders `FirstStepsDialog`. This keeps buttons out of `ReactNode` slots.
- **Order.** The dialog opens only the first step not done; later undone steps render as disabled buttons with a lock. Order is a presentation rule: the API still reports each step from its data, so a step done out of order shows as done.
- **Attention.** The menu item carries `data-attention` and the `first-steps-attention` class from `tokens.css`: primary colour, a soft tint and a 2-second box-shadow pulse, switched off under `prefers-reduced-motion`.
- **Steps lead by links.** Each step maps to a route. Opening the contact book or the profile, which live in `AppHeader` state, goes through search parameters: `?contacts=clients`, `?contacts=employees` and `?profile=open`. `AppHeader` reads them, opens the dialog and removes the parameter. `ContactBook` gains an `initialDirectory` prop. The ad-account step uses the first project id from the API.
- **Hint on connecting an account.** A new hint id `projects.firstAdAccount` on the "Добавить интеграцию" tile in `MetaIntegration`, which opens the choice of Meta or Google, shown while the project has no integration and the role is `ADMIN` or `MANAGER`.

## Risks / Trade-offs

- The step queries run on every list read: six to eight small counts per call, every minute per open tab of an admin or manager with steps left. Cheap, and it stops once the list is hidden or done.
- A step like "Пригласить сотрудника" ticks from a pending invitation that may never be accepted. Accepted: the point is to get the admin to invite.
- Existing members never see the welcome, including those who joined recently. Accepted to avoid surprising current users.

## Migration Plan

1. The migration adds both columns and fills them for existing memberships.
2. Deploy. New registrations get the welcome and, for admins and managers, the list.

## Open Questions

None.
