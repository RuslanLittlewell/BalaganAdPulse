# membership-admin-safety Specification

## Purpose
Membership administration prevents accidental organization lockout and limits elevation to administrators who already hold that authority.

## Requirements

### Requirement: Only admins grant the admin role

Only an actor whose fresh membership role is `ADMIN` SHALL create an invitation granting `ADMIN`. The API SHALL enforce this independently of UI visibility.

#### Scenario: Admin creates an admin invitation
- **WHEN** an admin creates an employee invitation with role `ADMIN`
- **THEN** the invitation is created if its other fields are valid

#### Scenario: Non-admin requests an admin invitation
- **WHEN** any non-admin submits an invitation granting `ADMIN`
- **THEN** the API responds 403 and stores no invitation

### Requirement: An administrator cannot delete themselves

An authenticated administrator SHALL NOT delete their own membership, regardless of how many other administrators remain. The Team UI SHALL omit or disable the self-removal action, and the API SHALL enforce the same rule.

#### Scenario: Admin attempts self-removal through the API
- **WHEN** an admin deletes the membership identified by their own actor context
- **THEN** the API responds 409 and the membership remains active

#### Scenario: Admin removes another member
- **WHEN** an admin removes a different member and the existing last-admin rule remains satisfied
- **THEN** that membership is removed
