## Purpose

A visitor starts a trial alone: they ask for a new organization, confirm their email, and land in the app as its first administrator, with no invitation and no help from the platform administrator.

## ADDED Requirements

### Requirement: The trial page asks for an organization and an account

The web app SHALL serve `/trial` to visitors without a session. The page SHALL ask for the organization's name, the visitor's name, an email, a password and its confirmation. It SHALL refuse to submit while a field is empty, while the email is malformed, while the password is shorter than 8 characters, and while the confirmation differs from the password, saying so against the field. A signed-in visitor who opens it SHALL be taken into the app. The sign-in page SHALL offer a link to it.

#### Scenario: Passwords that differ
- **WHEN** a visitor enters two different passwords
- **THEN** the form says the passwords do not match, against the confirmation field, and sends nothing

#### Scenario: A short password
- **WHEN** a visitor enters a password shorter than 8 characters
- **THEN** the form says it is too short and sends nothing

#### Scenario: A signed-in visitor
- **WHEN** a signed-in member opens `/trial`
- **THEN** they are taken into the app

### Requirement: A signup request is accepted without revealing accounts

`POST /api/trial-signups` SHALL take an organization name, a name, an email and a password of at least 8 characters, and SHALL answer 202 whether or not an account already uses the email. When no account uses the email, it SHALL mail that address a confirmation link. When an account does, it SHALL send no confirmation link. It SHALL create no organization and no account. A malformed body SHALL answer 400. The request SHALL be limited in rate like signing in, and at most three requests for one email address SHALL be accepted in an hour; further ones SHALL answer 429 whether or not an account uses the address.

The page SHALL then say that a link has been sent to the address and offer a way back to sign-in.

#### Scenario: A new email
- **WHEN** a visitor sends a valid request with an email no account uses
- **THEN** the API responds 202, a confirmation email goes to that address, and no organization exists yet

#### Scenario: A registered email
- **WHEN** a visitor sends a valid request with the email of an existing account
- **THEN** the API responds 202, the same as for a new one, and no confirmation email is sent

#### Scenario: Invalid body
- **WHEN** the request has an empty organization name, a malformed email or a password shorter than 8 characters
- **THEN** the API responds 400 and stores nothing

#### Scenario: One address asked for too often
- **WHEN** four requests for the same email arrive within an hour from different network addresses
- **THEN** the fourth answers 429 and no fourth email is sent

#### Scenario: Too many requests
- **WHEN** one client sends signup requests faster than the sign-in limit allows
- **THEN** the API responds 429

### Requirement: A confirmation link works once, for one day

A confirmation link SHALL carry a token that cannot be guessed, and the system SHALL keep only a hash of it, and a hash of the password rather than the password. A link SHALL stop working 24 hours after it was sent, once it has been used, and once a newer link has been asked for the same email. A link that does not work SHALL be refused with 404 and one message, whatever the reason.

#### Scenario: An expired link
- **WHEN** a visitor opens a link sent more than 24 hours ago
- **THEN** the page says the link is invalid or expired and offers to start again, and the API answers that token with 404

#### Scenario: A used link
- **WHEN** a visitor opens a link that has already created an organization
- **THEN** it is refused as invalid or expired

#### Scenario: A newer link
- **WHEN** a visitor asks for a second link with the same email before using the first
- **THEN** the first link is refused and the second works

### Requirement: Confirming creates the organization and signs the visitor in

Opening `/trial/confirm/:token` SHALL redeem the link: the system SHALL create a `TRIAL` organization named as requested, with `trialEndsAt` set as for any trial and a slug derived from the name and made unique, SHALL create the account with the requested name, email and password, and SHALL make it an active `ADMIN` of that organization, all in one transaction. It SHALL then sign the visitor in and take them into the app. If any part fails, none of it SHALL be stored and the link SHALL still work.

If an account has taken the email since the link was sent, the redemption SHALL be refused as the link that does not work is, and nothing SHALL be stored.

#### Scenario: Confirming
- **WHEN** a visitor opens a working link
- **THEN** the organization is on `TRIAL`, the account is its only active member with the `ADMIN` role, the link is spent, and the visitor is signed in inside the app

#### Scenario: Organization name used twice
- **WHEN** an organization with the same name already exists
- **THEN** the new organization is created with a distinct slug

#### Scenario: The email was taken meanwhile
- **WHEN** an account was registered with the email after the link was sent
- **THEN** the link is refused as invalid or expired and no organization is created

#### Scenario: A failure part-way
- **WHEN** storing the account fails
- **THEN** no organization is stored either, and the link still works

#### Scenario: Opening the link twice at once
- **WHEN** two requests redeem the same link at the same moment
- **THEN** one succeeds and the other is refused, and exactly one organization exists

### Requirement: The confirmation email is sent over SMTP

The confirmation email SHALL be sent over the same SMTP account as the password reset email. It SHALL be in Russian, SHALL NOT repeat the names typed into the form, so it cannot carry someone else's text to a stranger, SHALL carry the link built on the configured address of the app, say that it works for 24 hours, and say that it can be ignored by someone who did not ask for it. Failing to send SHALL be logged and SHALL NOT change the answer the visitor gets. Without mail configured, outside production the link SHALL be written to the server log; in production the request SHALL answer 503 and the page SHALL say that signup is unavailable and to contact an administrator.

#### Scenario: The email
- **WHEN** a confirmation email is sent
- **THEN** it is in Russian, carries the link, says it works for 24 hours, and contains neither the typed organization name nor the typed name

#### Scenario: Mail is not configured in production
- **WHEN** a visitor sends a request while the production server has no mail configured
- **THEN** the API responds 503 and the page says signup is unavailable
