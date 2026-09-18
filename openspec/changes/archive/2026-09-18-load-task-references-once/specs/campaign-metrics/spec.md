## MODIFIED Requirements

### Requirement: A project's campaigns can be listed as references

The system SHALL offer a listing of a project's campaigns carrying only what identifies
one — its id, its name and its channel — with no date range and no measured figures.
The listing SHALL follow the same reach rules as every other campaign reading: a member
who cannot reach the project SHALL be told it does not exist.

The same references SHALL also be listable for the whole organization in one reading,
carrying each campaign's project alongside its id, name and channel, and covering exactly
the campaigns of the projects the member reaches. A member who reaches nothing SHALL be
answered with an empty listing rather than a refusal.

This exists so that choosing a campaign is not a metrics reading. Asking for every
campaign's figures to render a picker would compute sums nobody reads, and would make
the list depend on a period the chooser never named. Naming a campaign on a screen that
spans projects — the task board — would otherwise cost one reading per project.

#### Scenario: Listing a project's campaigns for a picker

- **WHEN** a member asks for the campaigns of a project they can reach, naming no range
- **THEN** every campaign of that project is returned with its id, name and channel, and
  no figures

#### Scenario: A project the member cannot reach

- **WHEN** a member asks for the campaigns of a project they hold no grant for
- **THEN** the API responds 404

#### Scenario: Listing every campaign a member reaches

- **WHEN** a manager granted two of the organization's ten clients asks for the whole
  organization's campaign references
- **THEN** the campaigns of those two clients' projects are returned, each naming its
  project, and no other campaign is

#### Scenario: A member who reaches nothing

- **WHEN** a member holding no grant asks for the whole organization's campaign references
- **THEN** the API responds 200 with an empty listing

#### Scenario: References carry no figures

- **WHEN** the whole organization's campaign references are read
- **THEN** each carries an id, a project, a name and a channel, and no spend, impressions
  or any other measured figure
