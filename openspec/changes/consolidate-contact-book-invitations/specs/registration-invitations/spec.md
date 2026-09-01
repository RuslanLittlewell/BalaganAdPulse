## Purpose

Registration invitations are backend-owned, typed, short-lived onboarding capabilities that safely select the future client or employee registration experience.

## ADDED Requirements

### Requirement: Every invitation has a registration type

An invitation SHALL have exactly one registration type: `CLIENT` or `EMPLOYEE`. An employee invitation SHALL carry one of the employee roles `ADMIN`, `MANAGER`, or `GUEST` and one or more project identifiers; a client invitation SHALL carry neither.

#### Scenario: Valid employee invitation input
- **WHEN** an authorized actor creates an `EMPLOYEE` invitation with a valid role and projects in their organization
- **THEN** the invitation is stored with that role and those projects

#### Scenario: Employee project from another organization
- **WHEN** an actor includes a project outside their organization
- **THEN** the API responds 400 and stores no invitation

#### Scenario: Client invitation includes employee fields
- **WHEN** a caller creates a `CLIENT` invitation with a role or project identifiers
- **THEN** the API responds 400 and stores no invitation

#### Scenario: Employee invitation requests the client role
- **WHEN** a caller creates an `EMPLOYEE` invitation with role `CLIENT`
- **THEN** the API responds 400 and stores no invitation

### Requirement: The backend generates short invitation links

The backend SHALL generate each invitation code as eight cryptographically random characters, SHALL retry on a uniqueness collision, and SHALL return `registrationUrl` in the exact relative form `/regustration/{code}`. A caller SHALL NOT provide or override the code or URL.

#### Scenario: Invitation is created
- **WHEN** a valid invitation creation request succeeds
- **THEN** its code is exactly eight allowed characters and its `registrationUrl` ends with that code

#### Scenario: Generated code collides
- **WHEN** a generated code already belongs to another invitation
- **THEN** the backend generates another code without exposing an error or overwriting the existing invitation

### Requirement: Public resolution selects the registration form

The API SHALL expose an unauthenticated lookup by invitation code that returns only the valid pending invitation's registration type. It SHALL NOT expose organization, role, projects, creator, recipient, or status details.

#### Scenario: Resolving a client link
- **WHEN** a visitor resolves a valid pending client invitation code
- **THEN** the API returns `{ "registrationType": "CLIENT" }`

#### Scenario: Resolving an employee link
- **WHEN** a visitor resolves a valid pending employee invitation code
- **THEN** the API returns `{ "registrationType": "EMPLOYEE" }`

#### Scenario: Probing unusable codes
- **WHEN** a visitor resolves an unknown, revoked, used, or expired code
- **THEN** every case returns the same status and error envelope

### Requirement: Ordinary lists contain pending invitations only

The authenticated invitation-list endpoint SHALL return only unredeemed, unrevoked, unexpired invitations from the actor's organization, optionally filtered by registration type. Revocation SHALL preserve the database row for history while removing it from subsequent ordinary list responses.

#### Scenario: Listing after revocation
- **WHEN** an admin revokes a pending invitation and lists invitations again
- **THEN** the revoked invitation is absent from the response

#### Scenario: Historical rows exist
- **WHEN** a revoked or used invitation is inspected through persistence or a future history capability
- **THEN** its original data and terminal timestamps remain intact

#### Scenario: Filtering employee invitations
- **WHEN** an admin lists invitations with registration type `EMPLOYEE`
- **THEN** only pending employee invitations in their organization are returned

### Requirement: Redemption applies employee project access atomically

Redeeming an employee invitation SHALL create the membership with the invitation's role and project access for every selected project in the same transaction as account creation and invitation claim.

#### Scenario: Employee registration succeeds
- **WHEN** an employee redeems a valid invitation
- **THEN** the account, membership, selected project grants, and invitation claim commit together

#### Scenario: A project grant fails
- **WHEN** any selected project grant cannot be created
- **THEN** account creation, membership creation, every grant, and invitation claim are rolled back

### Requirement: Client registration remains deferred

Resolving a client invitation SHALL identify the client form, but redeeming a client invitation SHALL remain unavailable until client registration is introduced.

#### Scenario: Client registration is attempted early
- **WHEN** a caller tries to redeem a client invitation through the employee registration endpoint
- **THEN** the API refuses it without consuming the invitation
