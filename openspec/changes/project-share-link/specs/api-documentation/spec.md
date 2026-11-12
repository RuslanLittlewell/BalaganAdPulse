## MODIFIED Requirements

### Requirement: Operations state their authentication and their failures

The document SHALL declare the session cookie and the bearer token as its security
schemes, and SHALL apply them to every operation except those an unauthenticated caller
may reach: registering, logging in, refreshing, logging out, resolving a registration
code, the reads served through a share link, and the documentation itself.

Every operation SHALL describe its success response and the error envelope
`{ "error": { "message": string, "details"?: unknown } }` shared by every failure, with
the status codes that operation can answer.

#### Scenario: An authenticated operation

- **WHEN** the document describes `GET /api/projects`
- **THEN** the operation requires one of the declared security schemes and describes 401

#### Scenario: An open operation

- **WHEN** the document describes `POST /api/auth/login`
- **THEN** the operation requires no security scheme

#### Scenario: A read through a share link

- **WHEN** the document describes `GET /api/shared/{token}/projects/{projectId}/campaigns`
- **THEN** the operation requires no security scheme and describes 404 and 429
