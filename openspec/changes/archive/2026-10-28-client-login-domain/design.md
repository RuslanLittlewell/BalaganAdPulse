## Context

Logins live in `app_user.login`, unique, apart from `app_user.email`. Sign-in chose the
column by the shape of the value: with an `@` an email, otherwise a login. A login ending in
`@balagan.pro` breaks that rule, and the agency's own staff are likely to have real
addresses on the same domain, so the domain alone cannot tell the two apart.

## Goals / Non-Goals

**Goals:**
- Every login, new and already issued, ends with `@balagan.pro`.
- A client signs in with that login; staff keep signing in with their email.

**Non-Goals:**
- Making the domain configurable per organization.
- Mailboxes for logins, or recovery mail for accounts without an email.

## Decisions

- **The login stays in `login`, `email` stays null.** Storing it as the email would let
  notifications, invitations and recovery mail go to an address nobody reads.
- **Sign-in looks up the login first, then the email.** Two unique columns may in theory
  hold the same string on two accounts. Login first means a member can never shadow a
  client's login with their email; the reverse is closed off at generation.
- **Generation treats a login equal to an existing email as taken**, checked in the same
  transaction that creates the account, and retries with other digits as for a taken login.
- **The domain is a constant of the client-accounts domain.** One agency uses the product;
  a setting can come when a second one does.
- **A data migration appends the ending** to logins without an `@`. It is a no-op where the
  cabinet migration has just added an empty column.

## Risks / Trade-offs

- [A member registers later with an email equal to an existing login] → they cannot sign in
  by that email, since the login wins; the client's account is unaffected. Such an address
  would have to be a mailbox on `balagan.pro` the agency itself creates.
- [The forgot-password link now carries a typed login over to recovery, since it looks like
  an email] → recovery answers the same as for an unknown address and sends nothing.

## Migration Plan

Deploy as usual; `migrate deploy` applies the data migration. Code from before this change
would look a login with the ending up as an email and not find it, so rolling back the code
means stripping the ending from stored logins as well.
