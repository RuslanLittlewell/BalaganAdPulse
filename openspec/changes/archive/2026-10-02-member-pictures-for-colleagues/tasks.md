## 1. Pictures follow the roster

- [x] 1.1 Narrow `discloses` to the person fields it reads.
- [x] 1.2 In `member-use-cases.ts`, serve a picture when `discloses` allows it, answering 404 otherwise.
- [x] 1.3 Add API tests: a manager and a guest get an admin's picture; a customer gets a manager's picture and a colleague's on the same client, and 404 for a customer of another client; another organization's member gets 404.
- [x] 1.4 Run `npm test` and `npm run test:web` until green; `openspec validate member-pictures-for-colleagues --strict`.
