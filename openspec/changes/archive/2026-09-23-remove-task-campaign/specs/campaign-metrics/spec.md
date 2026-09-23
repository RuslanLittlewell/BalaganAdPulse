## REMOVED Requirements

### Requirement: A project's campaigns can be listed as references

**Reason**: This requirement covered two listings: a project's own campaigns (still needed
by the CRM lead form) and the whole organization's campaigns in one reading (needed only by
the task board and task form, to show a campaign's name without a reading per project). With
no task naming a campaign, the organization-wide listing has no remaining caller.

**Migration**: Replaced by "A project's own campaigns can be listed as references", which
keeps the per-project listing exactly as it was and drops the organization-wide listing, its
endpoint and its scenarios.

## ADDED Requirements

### Requirement: A project's own campaigns can be listed as references

The system SHALL offer a listing of a project's campaigns carrying only what identifies
one — its id, its name and its channel — with no date range and no measured figures.
The listing SHALL follow the same reach rules as every other campaign reading: a member
who cannot reach the project SHALL be told it does not exist.

This exists so that choosing a campaign is not a metrics reading. Asking for every
campaign's figures to render a picker would compute sums nobody reads, and would make
the list depend on a period the chooser never named.

#### Scenario: Listing a project's campaigns for a picker

- **WHEN** a member asks for the campaigns of a project they can reach, naming no range
- **THEN** every campaign of that project is returned with its id, name and channel, and
  no figures

#### Scenario: A project the member cannot reach

- **WHEN** a member asks for the campaigns of a project they hold no grant for
- **THEN** the API responds 404
