## Context

Customer accounts exist already: `CLIENT_ADMIN` and `CLIENT` memberships reaching one client
through a client-wide `client_access` grant. They are created only by redeeming an invitation,
which needs the customer to fill in a form with their own email and password. Sign-in is by
email alone, and passwords are kept only as scrypt hashes, so nothing can be shown again.

## Goals / Non-Goals

**Goals:**
- An admin hands a client a working login and password in one click, and can look them up
  or replace them later.
- The generated account is an ordinary `CLIENT_ADMIN`: every existing customer rule applies
  to it unchanged.

**Non-Goals:**
- Changing what customers may do. The permission matrix for their roles is untouched.
- Several generated accounts per client, or generated accounts for agency staff.
- Choosing a login or password by hand.

## Decisions

### A new `client-accounts` module owns the generated account

It holds the use cases (read, create, issue a new password), the `client_account` table
linking a client to the membership created for it, and the user row's login and kept copy.
Membership enrolment and the client grant reuse the members module's
`PrismaMembershipEnrolment` and `PrismaInvitationProjectAccess.grantClient`, wired in
composition exactly as invitations do. The router is mounted at
`/api/clients/:clientId/account`, ahead of the clients router.

`client_account` points at the membership, not the user, with cascade. Removing the
membership from the contact book therefore drops the access, and the admin can create a new
one. Deleting a client deletes the user of its account in the same transaction, since a
login reaching nothing should not keep signing in.

### An account may have no email; logins live beside emails

`app_user.email` becomes nullable and `app_user.login` is added, unique, with a check that
at least one of the two is present. Sign-in looks a value up as an email when it contains
`@`, otherwise as a login, so the two never collide. Generated logins never contain `@`.

The alternative of storing a login in the email column was rejected: it would put
non-addresses into every payload documented as an email and into password-recovery mail.

The access token's `email` claim is left out for such an account, the request actor and
audit snapshot carry `email: null`, and `audit_event.actor_email` becomes nullable.

### The issued password is kept encrypted on the user row

`app_user.issued_password` holds the password the agency issued, encrypted with AES-256-GCM
bound to the user id as associated data. The identity module clears it whenever it sets a
password itself — profile change and password reset — which is how "the client changed it"
is detected: an account with a login and no kept copy.

The key is `INTEGRATION_ENCRYPTION_KEY`, the one already protecting advertising tokens, so
deploying needs no new configuration. The associated data keeps the two uses apart: an
integration token bound to a project id cannot be opened as a password bound to a user id.
The AES-GCM sealing moves to a shared helper used by both ciphers. If the key is absent,
creating access, issuing a password and reading a kept password all answer 503, so a
missing password in a read always means the client changed it.

### Generation

The login prefix is a pure domain function: lowercase, Cyrillic transliterated (Russian and
Belarusian letters), everything else turned into hyphens, runs collapsed, trimmed to twenty
characters, `client` when empty. The four digits and the password come from a crypto-backed
generator port. A login collision is detected by the unique index and retried with new digits
in a fresh transaction, up to five times.

The password alphabet leaves out `0 O o 1 l I`, so it can be read aloud or copied by hand.

### Order of checks

The client is resolved first through the actor's reach, so a stranger's client is a 404;
the role is checked next, so a manager reaching the client gets 403. This is the order the
clients module already uses.

### Sign-in body

`POST /api/auth/login` takes `{ login, password }`. The web app is its only caller. Keeping
`email` as an alias was rejected: it would carry a login under a name that says email.

## Risks / Trade-offs

- [A kept password is readable by anyone holding the key and the database] → It is
  encrypted, bound to the account, shown only to admins, and dropped as soon as the client
  sets their own.
- [One key protects two kinds of secret] → Rotating it already requires re-encrypting
  integration tokens; issued passwords join that, or are simply reissued.
- [Nullable email ripples through types] → The compiler finds every reader; payloads keep
  the `email` key and gain `null`.

## Migration Plan

One migration: nullable `email`, new `login` and `issued_password`, the check constraint,
`client_account`, nullable `audit_event.actor_email`. Existing rows all have emails, so the
check holds. Rolling back means dropping the new columns and table after removing any
generated accounts.
