## 1. The hint mechanism

- [x] 1.1 Add `Hint` to `shared/ui` on Radix Popover: anchored to its child, controlled, ignoring outside clicks and Escape, not taking focus, with an arrow, `role="status"` and its own close button; copy in `ru.ts`.
- [x] 1.2 Add the `hints` feature: a persisted store of dismissed hint ids per user id and a `useHint(id, applies)` hook returning whether to show it and how to dismiss it.

## 2. The first hint

- [x] 2.1 In the header, show the contact book hint to an `ADMIN` while there are no clients and no staff besides them, hidden while the contact book is open.
- [x] 2.2 Cover the hint: shown to a fresh organization's admin, not with a client, not with another employee, not to a manager, kept on an outside click and Escape, gone and remembered after closing, shown again for another person, hidden while the contact book is open; run `npm run test:web` until green.

## 3. Close

- [x] 3.1 Run `openspec validate onboarding-hints --strict` and `npm run test:web`, then archive the change.
