## Why

An organization's first administrator is invited by email, and the invitation only accepts
that address. The registration form still asks for an email, so the person types back
what the platform administrator already entered, and any other address is refused.

## What Changes

- Resolving an invitation code returns the email the invitation is bound to, or `null`
  when it is bound to none. **BREAKING** for the documented contract, which promised the
  lookup would never reveal the recipient; the response gains one field.
- Every registration form — employee, client and joining — shows a bound address as the
  account's email and does not ask for one; it still asks when the invitation names none.
- The client form uses that address for the new client's contact email as well.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `registration-invitations`: the public lookup names the bound email, and the
  registration forms take the email from the invitation when it has one.

## Impact

- API: `GET /api/regustration/:code` response and its OpenAPI description.
- Web: `RegistrationPage` passes the bound email to `EmployeeRegistrationForm`,
  `ClientRegistrationForm` and `JoinClientForm`.
- No schema change and no migration.
