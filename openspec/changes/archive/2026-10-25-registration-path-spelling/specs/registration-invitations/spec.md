## ADDED Requirements

### Requirement: Links with the old spelling still open the form

Opening `/regustration/:code`, the address invitations carried before its spelling was fixed,
SHALL replace the address with `/registration/:code` for the same code and show what that address
shows.

#### Scenario: An invitation sent before the fix
- **WHEN** a visitor opens `/regustration/ABCDEFGH`
- **THEN** the address becomes `/registration/ABCDEFGH` and the invitation's form is shown

## MODIFIED Requirements

### Requirement: The backend generates short invitation links

The backend SHALL generate each invitation code as eight cryptographically random characters, SHALL retry on a uniqueness collision, and SHALL return `registrationUrl` in the exact relative form `/registration/{code}`. A caller SHALL NOT provide or override the code or URL.

#### Scenario: Invitation is created
- **WHEN** a valid invitation creation request succeeds
- **THEN** its code is exactly eight allowed characters and its `registrationUrl` ends with that code

#### Scenario: Generated code collides
- **WHEN** a generated code already belongs to another invitation
- **THEN** the backend generates another code without exposing an error or overwriting the existing invitation

### Requirement: An invitation link opens the form its type calls for

Opening `/registration/:code` SHALL resolve the invitation's registration type and show
the form for it: the employee form for `EMPLOYEE`, the client form for `CLIENT`. A code
that is unknown, revoked, used or expired SHALL show one message that does not say which
of those it is.

The page SHALL be reachable without a session, since whoever follows the link has none.

#### Scenario: An employee invitation

- **WHEN** a visitor opens the link of a pending employee invitation
- **THEN** the employee registration form is shown

#### Scenario: A client invitation

- **WHEN** a visitor opens the link of a pending client invitation
- **THEN** the client registration form is shown

#### Scenario: A code that cannot be used

- **WHEN** a visitor opens a link whose code is unknown, revoked, used or expired
- **THEN** one message is shown for all four, and no form is offered
