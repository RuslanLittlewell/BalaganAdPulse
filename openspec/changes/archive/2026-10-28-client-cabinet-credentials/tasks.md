## 1. Schema and policy

- [x] 1.1 Migration: nullable `app_user.email`, `login` (unique), `issued_password`, check that an email or a login is present, `client_account` table, nullable `audit_event.actor_email`
- [x] 1.2 Add the `client-account` resource to the shared permission matrix, admins only

## 2. Identity

- [x] 2.1 Accounts may have no email: domain, repositories, access token claims, request actor, audit snapshot
- [x] 2.2 Sign-in by email or login; login body `{ login, password }`
- [x] 2.3 Setting a password through the profile or a reset drops the kept copy
- [x] 2.4 Session and profile carry `login`; nullable `email` in OpenAPI for session, profile, members and audit

## 3. Client accounts module

- [x] 3.1 Domain: login prefix from a client name
- [x] 3.2 Shared AES-GCM sealing used by the integration cipher and a new password cipher
- [x] 3.3 Use cases: read, create, issue a new password, with reach and role checks, retries on login collision, audit events
- [x] 3.4 Prisma repository, crypto generator, router, schemas, OpenAPI, wiring and mount
- [x] 3.5 Deleting a client deletes its cabinet account

## 4. Web

- [x] 4.1 Sign-in form takes an email or a login
- [x] 4.2 User menu and profile show the login of an account without email
- [x] 4.3 Client card section «Доступ в кабинет» for admins: create, show, copy, new password, changed by client
- [x] 4.4 Activity log reads the two new events

## 5. Tests and docs

- [x] 5.1 API tests: domain, use cases, HTTP, sign-in, kept copy dropped, deletion, audit, permissions
- [x] 5.2 Access-policy tests for the new resource
- [x] 5.3 Web tests: sign-in by login, card section, user menu, activity log
- [x] 5.4 README and API docs
