## ADDED Requirements

### Requirement: Signing out ends the session and returns to the sign-in form

Signing out SHALL end the session and take the person to the sign-in form, whether or not
the request revoking it reached the server. Nothing the previous session loaded SHALL
remain readable afterwards, and returning to a protected address SHALL ask for
credentials rather than restore what was on screen.

A network failure while signing out SHALL NOT leave someone inside a session they asked
to leave.

#### Scenario: Signing out

- **WHEN** a signed-in member signs out
- **THEN** they are taken to the sign-in form and the session is over

#### Scenario: Signing out while the server is unreachable

- **WHEN** the request revoking the session fails
- **THEN** the member is still signed out locally and still taken to the sign-in form

#### Scenario: Going back after signing out

- **WHEN** a signed-out visitor opens a protected address
- **THEN** they are shown the sign-in form, not the previous session's data

#### Scenario: The next person on the same computer

- **WHEN** someone signs in after another member signed out on that browser
- **THEN** they see their own clients, projects and tasks, never the previous member's
