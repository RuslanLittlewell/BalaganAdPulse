## RENAMED Requirements

- FROM: `### Requirement: Managers and guests reach only granted clients`
- TO: `### Requirement: Managers reach every client, guests only granted ones`

## MODIFIED Requirements

### Requirement: Managers reach every client, guests only granted ones

A `MANAGER` SHALL reach every client of their organization without needing an access
grant. A `GUEST` SHALL reach a client only when an access grant names that client for
their membership. For both roles, a project, its campaigns and its tasks SHALL be
reachable only through an access grant: a grant naming the client reaches all its
projects, and a grant naming a single project reaches only that project.

#### Scenario: Manager lists clients
- **WHEN** a manager holding a grant for two of the organization's ten clients calls
  `GET /api/clients`
- **THEN** all ten clients are returned, including clients created by an admin

#### Scenario: Manager never reaches another organization
- **WHEN** a manager requests a client belonging to a different organization by id
- **THEN** the API responds 404

#### Scenario: List is filtered to grants
- **WHEN** a guest granted two of the organization's ten clients calls `GET /api/clients`
- **THEN** exactly those two clients are returned

#### Scenario: Fetching an ungranted record by id
- **WHEN** a guest requests a client, or a manager or guest requests a project or
  campaign, they hold no grant for
- **THEN** the API responds 404, the same answer a genuinely missing id gets, so the
  response does not reveal that the record exists

#### Scenario: Seeing a client does not reveal its projects
- **WHEN** a manager without any grant lists projects of an organization whose clients
  have projects
- **THEN** no project is returned

#### Scenario: Project-scoped grant
- **WHEN** a member holds a grant naming one project of a client with three projects
- **THEN** listing that client's projects returns only the granted project
