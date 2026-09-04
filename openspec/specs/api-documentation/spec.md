# api-documentation Specification

## Purpose
The API publishes a description of itself — every endpoint it serves, what each one
accepts and what it answers — so that reading the routers is no longer the only way to
learn the surface, and so that a request shape stated in one place cannot quietly differ
from the one the API enforces.

## Requirements

### Requirement: The API serves an OpenAPI description of itself

The system SHALL serve an OpenAPI 3.1 document at `GET /api/openapi.json`, as JSON. The
document SHALL carry a title, a version and a server entry for the `/api` prefix, and it
SHALL be valid on its own terms: every `$ref` it contains SHALL resolve within it.

The document SHALL be readable without authentication. It describes the surface only; it
carries no data belonging to any organization, and answering it never consults the
database.

#### Scenario: Reading the document

- **WHEN** anyone asks for `GET /api/openapi.json`
- **THEN** the API answers 200 with an OpenAPI 3.1 document as `application/json`

#### Scenario: Reading it without credentials

- **WHEN** the request carries neither an access cookie nor an Authorization header
- **THEN** the API still answers 200, and no other `/api` endpoint becomes reachable

### Requirement: The document describes exactly the endpoints the API mounts

Every endpoint the API mounts under `/api` SHALL appear in the document, under the same
path and the same method the router serves, with its path parameters declared. The
document SHALL describe no endpoint the API does not mount.

This is what makes the document trustworthy: a description that lists an endpoint nobody
serves, or misses one that exists, is worse than none, because a reader cannot tell which
half is stale.

#### Scenario: Every mounted route is described

- **WHEN** the mounted routers are enumerated and compared with the document's paths
- **THEN** the two sets are equal, method by method

#### Scenario: A route added without its description

- **WHEN** a router gains an endpoint that the document does not describe
- **THEN** the test suite fails, naming the undescribed method and path

### Requirement: Request shapes come from the schemas that validate them

Where an endpoint validates a request body or query with a schema, the document's
description of that body or query SHALL be derived from that same schema, not restated
beside it. Required properties, enumerated values, formats and bounds SHALL therefore
match what the endpoint actually accepts.

#### Scenario: A body schema reaches the document

- **WHEN** the document describes an endpoint whose body is validated by a schema
- **THEN** the described body carries that schema's properties, its required ones and its
  enumerated values

#### Scenario: A schema gains a field

- **WHEN** a validating schema gains a property
- **THEN** the document describes the new property without any further edit

### Requirement: Operations state their authentication and their failures

The document SHALL declare the session cookie and the bearer token as its security
schemes, and SHALL apply them to every operation except those an unauthenticated caller
may reach — registering, logging in, refreshing, logging out, resolving a registration
code, and the documentation itself.

Every operation SHALL describe its success response and the error envelope
`{ "error": { "message": string, "details"?: unknown } }` shared by every failure, with
the status codes that operation can answer.

#### Scenario: An authenticated operation

- **WHEN** the document describes `GET /api/projects`
- **THEN** the operation requires one of the declared security schemes and describes 401

#### Scenario: An open operation

- **WHEN** the document describes `POST /api/auth/login`
- **THEN** the operation requires no security scheme

### Requirement: The description is browsable in a browser

The system SHALL serve a documentation page at `GET /api/docs` that renders the document
for reading and for trying requests against the running API. Its assets SHALL be served
by the API itself, so the page works with no access to a third-party network.

#### Scenario: Opening the page

- **WHEN** a browser asks for `GET /api/docs`
- **THEN** the API answers 200 with an HTML page that loads `/api/openapi.json`

#### Scenario: Asking with no trailing slash

- **WHEN** a browser asks for `GET /api/docs` without a trailing slash
- **THEN** the page still renders, rather than answering 404

### Requirement: An operator can withdraw the documentation

The system SHALL stop serving both the document and the page when the environment sets
`API_DOCS=off`. A withdrawn path SHALL then answer exactly as any path under `/api` that
nobody serves answers — 401 to a caller with no session, 404 to one that has a session —
so that withdrawing the documentation is indistinguishable from never having served it.
With the variable unset the documentation SHALL be served.

#### Scenario: Documentation withdrawn

- **WHEN** `API_DOCS=off` and a request asks for `/api/openapi.json` or `/api/docs`
- **THEN** the API answers with the same status and body as a request for a path it has
  never served

#### Scenario: The default

- **WHEN** `API_DOCS` is not set
- **THEN** both the document and the page are served
