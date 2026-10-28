## Why

The agency wants every cabinet login it hands a client to read as an address of its own
domain, `balagan.pro`, so a client sees whose cabinet it is and a login cannot be taken for
a bare word.

## What Changes

- A generated login ends with `@balagan.pro`: `klinika-zdorove-4821@balagan.pro` in place of
  `klinika-zdorove-4821`. It stays a login, not an email: the account still has no email and
  receives no mail.
- Sign-in matches the typed value against logins first and against emails when no login
  matches, since a login now carries an `@` too.
- A login equal to an existing account's email counts as taken and is generated again.
- Logins issued before this change gain the ending, so every login has it.

## Capabilities

### New Capabilities

### Modified Capabilities
- `client-credentials`: the shape of a generated login and how sign-in tells a login from an
  email.

## Impact

- API: logins returned by `/api/clients/:clientId/account` end with `@balagan.pro`; sign-in
  looks a value up by login, then by email.
- Database: a data migration appends `@balagan.pro` to every stored login without an `@`.
- Web: none beyond what the API returns; the sign-in field already takes an email or a login.
