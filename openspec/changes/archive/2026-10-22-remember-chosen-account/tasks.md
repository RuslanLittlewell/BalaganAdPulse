## 1. Remembering the account

- [x] 1.1 Keep the chosen account per project in browser storage and read it when the project page opens.
- [x] 1.2 Fall back to the first account when the remembered one is not among the project's accounts.

## 2. Verification

- [x] 2.1 Cover returning from a campaign and a stale choice.
- [x] 2.2 Run `npm run test:web` until green; `openspec validate remember-chosen-account --strict`.
