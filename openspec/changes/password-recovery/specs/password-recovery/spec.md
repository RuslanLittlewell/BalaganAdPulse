## Purpose

A member who has forgotten their password gets back in by proving they hold the mailbox
of their account: the system mails them a short-lived link that lets them choose a new one.

## ADDED Requirements

### Requirement: The sign-in form leads to password recovery

The sign-in form SHALL offer a «Забыли пароль?» link directly under the password field, at
its right edge. Following it SHALL open a page that asks for an email, filled with the
email already typed into the sign-in form when there is one.

#### Scenario: Forgetting the password

- **WHEN** a visitor on the sign-in form chooses «Забыли пароль?»
- **THEN** the password recovery page opens and asks for their email

#### Scenario: The email carries over

- **WHEN** a visitor typed their email on the sign-in form before choosing the link
- **THEN** the recovery page's email field already holds it

### Requirement: A reset link is asked for by email without revealing accounts

Asking for a reset link SHALL take an email and SHALL answer the same way whether or not an
account uses it, so the answer never tells who is registered. When an account uses the
email, the system SHALL email that address a link to set a new password. The page SHALL
then say that a link has been sent if the account exists, and offer a way back to sign-in.
Asking SHALL be limited in rate like signing in.

#### Scenario: A registered email

- **WHEN** a visitor asks for a link with the email of an account
- **THEN** the API responds 202 and an email with a reset link is sent to that address

#### Scenario: An unknown email

- **WHEN** a visitor asks for a link with an email no account uses
- **THEN** the API responds 202, the same as for a registered one, and no email is sent

#### Scenario: What the visitor is told

- **WHEN** the request is accepted
- **THEN** the page says a link has been sent if an account uses that email, and offers a
  way back to sign-in

### Requirement: A reset link works once, for one hour

A reset link SHALL carry a token that cannot be guessed, and the system SHALL keep only a
hash of it. A link SHALL stop working one hour after it was sent, once it has been used,
and once a newer link has been asked for the same account. A link that does not work SHALL
be refused with one answer, whatever the reason, so the answer never tells whether it ever
existed.

#### Scenario: Opening a working link

- **WHEN** a visitor opens a link sent less than an hour ago and not yet used
- **THEN** the form for a new password is shown

#### Scenario: An expired link

- **WHEN** a visitor opens a link sent more than an hour ago
- **THEN** the page says the link is invalid or expired and offers to ask for a new one, and
  the API answers that token with 404

#### Scenario: A used link

- **WHEN** a visitor opens a link that has already set a password
- **THEN** it is refused as invalid or expired

#### Scenario: A newer link

- **WHEN** a member asks for a second link before using the first
- **THEN** the first link is refused and the second works

### Requirement: A new password is chosen twice and must match

The link's form SHALL ask for a new password and its confirmation. It SHALL refuse to submit
when the two differ, saying so against the confirmation field, and when the password is
shorter than 8 characters, as registration does. The API SHALL refuse a password shorter
than 8 characters with 400.

#### Scenario: Passwords that differ

- **WHEN** a visitor enters two different passwords
- **THEN** the form says the passwords do not match, against the confirmation field, and
  sends nothing

#### Scenario: A short password

- **WHEN** a visitor enters a password shorter than 8 characters
- **THEN** the form says it is too short and sends nothing

### Requirement: Setting a new password signs out everywhere else

Setting a new password with a working link SHALL replace the account's password, SHALL end
every session the account had, and SHALL sign the visitor in with a new one, taking them
into the app. Afterwards the old password SHALL NOT sign in and the new one SHALL.

#### Scenario: Resetting the password

- **WHEN** a visitor sets a new password through a working link
- **THEN** they are signed in and taken into the app, the old password no longer signs in,
  and the new one does

#### Scenario: Other sessions end

- **WHEN** the account was signed in on another device before the reset
- **THEN** that device's session can no longer be renewed

### Requirement: The reset email is sent over SMTP

The system SHALL send the reset email over SMTP using the configured account, by default
Google's server over TLS on port 465. The email SHALL be in Russian, name the account, carry
the link built on the configured address of the app, say that it works for one hour, and say
that it can be ignored by someone who did not ask for it. Failing to send SHALL be logged and
SHALL NOT change the answer the visitor gets. Without mail configured, outside production the
link SHALL be written to the server log instead; in production asking for a link SHALL answer
503, and the page SHALL say that recovery is unavailable and to contact an administrator.

#### Scenario: The email

- **WHEN** a reset email is sent
- **THEN** it is in Russian, names the account, carries the link and says it works for one
  hour

#### Scenario: Mail is not configured in production

- **WHEN** a visitor asks for a link while the production server has no mail configured
- **THEN** the API responds 503 and the page says recovery is unavailable
