## 1. Web

- [x] 1.1 Give `InvitationDialog` an optional `audience` prop for `CLIENT_STAFF` invitations: with it the dialog starts in that mode, hides its own «Сотрудник / Партнёр» tabs and titles itself by the mode; without it nothing changes
- [x] 1.2 Split `CompanyTeam` into the tabs «Сотрудники» and «Партнёры» with a list, a heading, an empty state and an add button each; show the tab bar only when the reader may invite partners or a partner is listed; keep the removal confirmation for partners on «Партнёры»
- [x] 1.3 Add the dictionary keys in `ru.ts` and `en.ts`
- [x] 1.4 Update `ContactBook.test.tsx` and the invitation dialog tests: both tabs before pressing anything, partners only on «Партнёры», each button opening the right dialog without a choice, the partner form as before, no tab bar and no partner button for a reader who may not invite partners, partners listed read-only for such a reader, partner removal; run `npm run test:web`
