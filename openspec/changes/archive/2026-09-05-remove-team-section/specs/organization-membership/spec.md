## ADDED Requirements

### Requirement: Members are administered through the API alone

The web interface SHALL offer one place to look at the organization's members — the
contact book's employee directory — and that view SHALL be read-only. It SHALL NOT offer
a control that changes a member's role or status, or removes them from the organization.

The API SHALL continue to accept all three changes, with the rules it already enforces
unchanged: only an admin may make them, an admin may not remove their own membership,
and the last admin may not be removed. Removing the interface removes a way to ask, not
a rule about who may.

An address that named the removed section SHALL lead somewhere useful rather than to a
blank screen.

#### Scenario: Looking at the members

- **WHEN** a member opens the contact book's employee pane
- **THEN** each member is shown with their name, email and role, and no control changes
  any of them

#### Scenario: No navigation entry

- **WHEN** any member looks at the main navigation
- **THEN** it offers no Team section, whatever their role

#### Scenario: An address that named the removed section

- **WHEN** someone opens `/team` from a bookmark
- **THEN** they are taken to the dashboard

#### Scenario: The rules are unchanged

- **WHEN** an admin changes a member's role through the API
- **THEN** it is accepted exactly as before, and the same refusals apply
