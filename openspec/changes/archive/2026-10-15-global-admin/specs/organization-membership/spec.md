## MODIFIED Requirements

### Requirement: Access requires an active membership

Every authenticated request to an organization endpoint SHALL be resolved against a
membership in the organization that owns the addressed data. A user with no membership,
or whose membership is `SUSPENDED`, or whose organization is `SUSPENDED`, SHALL be refused. The platform administrator holds no
membership and is therefore refused on every organization endpoint; it is served only by
the platform endpoints and the session endpoints.

#### Scenario: Authenticated user without a membership
- **WHEN** a user with a valid access token but no membership calls any `/api` endpoint
  other than the auth and platform endpoints
- **THEN** the API responds 403 with the standard error envelope

#### Scenario: Suspension takes effect immediately
- **WHEN** an admin suspends a member who holds an access token issued minutes earlier
- **THEN** that member's very next request is refused, without waiting for the token to
  expire

#### Scenario: Organization suspended
- **WHEN** an organization is suspended and one of its active members calls any
  organization endpoint
- **THEN** the API responds 403 with the message "Organization is suspended"

#### Scenario: Platform administrator session
- **WHEN** the platform administrator calls `GET /api/auth/me`
- **THEN** the response marks them as the platform administrator and names no organization
