## 1. Managers reach every client

- [x] 1.1 In `prisma-client-repository.ts`, reach every client of the organization for `MANAGER` as for `ADMIN`; keep grant-only reach for other roles.
- [x] 1.2 Update API and adapter tests: a manager lists and reads clients created by an admin and by another manager, still gets 404 for another organization's client and for ungranted projects; a guest still sees only granted clients; a manager without grants lists no projects.
- [x] 1.3 Run `npm test` and `npm run test:web` until green; `openspec validate managers-reach-all-clients --strict`.
