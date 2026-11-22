## MODIFIED Requirements

### Requirement: An operator can withdraw the documentation

The system SHALL stop serving both the document and the page when the environment sets
`API_DOCS=off`, and in production unless the environment sets `API_DOCS=on`. A withdrawn path SHALL then answer exactly as any path under `/api` that
nobody serves answers — 401 to a caller with no session, 404 to one that has a session —
so that withdrawing the documentation is indistinguishable from never having served it.
With the variable unset the documentation SHALL be served outside production and withdrawn in
production.

#### Scenario: Documentation withdrawn

- **WHEN** `API_DOCS=off` and a request asks for `/api/openapi.json` or `/api/docs`
- **THEN** the API answers with the same status and body as a request for a path it has
  never served

#### Scenario: The default

- **WHEN** `API_DOCS` is not set outside production
- **THEN** both the document and the page are served

#### Scenario: Production

- **WHEN** `API_DOCS` is not set in production
- **THEN** both paths answer as paths the API has never served

#### Scenario: Production on request

- **WHEN** `API_DOCS=on` in production
- **THEN** both the document and the page are served
