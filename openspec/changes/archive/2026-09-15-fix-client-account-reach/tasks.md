## 1. Whole-client reach for customer accounts

- [x] 1.1 Write and observe failing API tests for client registration enrolling a `CLIENT_ADMIN` with a whole-client grant who still reaches the client and sees a newly added project after the first project is deleted; client-staff joining granting the whole client; and the migration repairing project-only customer grants, promoting client registrants and leaving staff grants alone.
- [x] 1.2 Implement the whole-client grant, the principal role on registration, the joining grant and the data migration; apply the migration to a copy of the populated development database.
- [x] 1.3 Shorten the empty project list message so it does not wrap.
- [x] 1.4 Run `npm test` and `npm run test:web` until both are green.
