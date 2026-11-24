# two-factor-authentication Specification

## Purpose
Ask for a code from an authenticator app whenever an account signs in from a network address it has not confirmed, so a password alone does not open an account.

## Requirements

### Requirement: A member turns on two-factor sign-in with an authenticator app

A signed-in member SHALL be able to start setting up two-factor sign-in from the profile settings. The second factor SHALL be Google Authenticator: the system SHALL create a new secret, SHALL show it as a QR code and as a text key in the form Google Authenticator reads (RFC 6238 with its defaults: SHA-1, six digits, 30 seconds, the issuer «Balagan BI» encoded so the app shows it with a space), SHALL tell the member to scan it in Google Authenticator and link to the app in the App Store and Google Play, and SHALL turn two-factor sign-in on only after the member types a current code from the app. Turning it on SHALL show ten one-time backup codes once, with a copy control, and SHALL trust the address the member is using. Starting again before confirming SHALL replace the unconfirmed secret. The secret SHALL be stored so that it cannot be read back, and the backup codes SHALL be stored as hashes; neither SHALL be returned after setup.

#### Scenario: Turning it on
- **WHEN** a member scans the QR code in Google Authenticator and types the code it shows
- **THEN** two-factor sign-in is on, ten backup codes are shown once, and the current address is trusted

#### Scenario: A wrong code during setup
- **WHEN** the member types a code the secret does not produce
- **THEN** the API responds 400 and two-factor sign-in stays off

#### Scenario: Nothing to read back
- **WHEN** a member with two-factor sign-in reads their profile or session
- **THEN** neither the secret nor the backup codes are in the answer

### Requirement: Sign-in from an unconfirmed address asks for a code

When an account with two-factor sign-in gives the right password from a network address it has not confirmed, the sign-in SHALL answer with a challenge instead of a session: an unguessable token valid for five minutes and for that account only. Sending the challenge with a current code from the app, or with an unused backup code, SHALL sign the member in and SHALL trust that address from then on, until the member forgets it. A code SHALL work only once: a code already used to sign in SHALL be refused within its 30 seconds. A backup code SHALL be spent when used. Wrong codes SHALL count toward the sign-in lock of the account, as wrong passwords do, and a locked account SHALL refuse codes. An address the account has confirmed SHALL sign in with the password alone. Sessions that already exist SHALL NOT be asked for a code when their address changes.

The sign-in form SHALL then ask for the code in six separate digit slots that accept typing and pasting, SHALL send the code as soon as the sixth digit is in, SHALL offer to type a backup code instead, and SHALL sign the member in when the code is accepted. A refused code SHALL be cleared from the slots and the form SHALL say it does not match.

#### Scenario: A new address
- **WHEN** a member with two-factor sign-in signs in with the right password from an address they never confirmed
- **THEN** no session is created and the form asks for a code

#### Scenario: The right code
- **WHEN** the member types the current code
- **THEN** they are signed in, and the next sign-in from that address asks only for the password

#### Scenario: Pasting the code
- **WHEN** the member pastes `123456` into the code slots
- **THEN** all six slots fill and the code is sent without pressing a button

#### Scenario: A backup code
- **WHEN** the member types an unused backup code instead
- **THEN** they are signed in and that backup code no longer works

#### Scenario: A code typed twice
- **WHEN** a code that already signed the member in is sent again with a new challenge within its 30 seconds
- **THEN** it is refused

#### Scenario: Wrong codes
- **WHEN** three wrong codes are sent for the account
- **THEN** sign-in is locked for 15 minutes, as after three wrong passwords

#### Scenario: An expired challenge
- **WHEN** a code arrives more than five minutes after the password was accepted
- **THEN** it is refused and the member signs in again

#### Scenario: Without two-factor sign-in
- **WHEN** a member who never turned it on signs in from a new address
- **THEN** the password alone signs them in

### Requirement: A reset link signs in through the same code step

Setting a new password through a reset link SHALL change the password and end the other sessions as before. When the account has two-factor sign-in and the address is unconfirmed, the answer SHALL be a challenge instead of a session, and the reset page SHALL ask for the code before taking the member into the app.

#### Scenario: Reset from a new address
- **WHEN** a member with two-factor sign-in sets a new password through a link from an unconfirmed address
- **THEN** the password changes, and the page asks for a code before signing in

### Requirement: Trusted addresses are listed and can be forgotten

The profile settings SHALL list the addresses the account trusts, with when each was confirmed and last used, and SHALL let the member forget one or all of them. A forgotten address SHALL ask for a code at its next sign-in.

#### Scenario: Forgetting an address
- **WHEN** a member forgets an address and later signs in from it
- **THEN** the sign-in asks for a code

### Requirement: Turning it off and new backup codes need a current code

Turning two-factor sign-in off SHALL need a current code or an unused backup code, and SHALL delete the secret, the backup codes and the trusted addresses. Issuing new backup codes SHALL need a current code, SHALL replace every old backup code, and SHALL show the new ones once. An employee whose organization requires two-factor sign-in SHALL NOT be able to turn it off.

#### Scenario: Turning it off
- **WHEN** a member types a current code and turns two-factor sign-in off
- **THEN** sign-in asks only for the password, from any address

#### Scenario: Required by the organization
- **WHEN** an employee of an organization that requires it tries to turn it off
- **THEN** the API responds 403 and it stays on

### Requirement: An organization admin can require two-factor sign-in for employees

An organization ADMIN SHALL be able to require two-factor sign-in for the organization's employees: its admins, managers and guests. Clients and partners SHALL NOT be affected. While it is required, an employee without two-factor sign-in SHALL be able to sign in, read the session and set it up, and every other request SHALL answer 403 with details `[{ code: "TWO_FACTOR_SETUP_REQUIRED" }]`. The web app SHALL show such an employee the setup screen instead of the app. Only an ADMIN SHALL change the requirement.

#### Scenario: Requiring it
- **WHEN** an admin requires two-factor sign-in and a manager without it signs in
- **THEN** the manager sees the setup screen, and the projects API answers 403 until they finish it

#### Scenario: A client
- **WHEN** the requirement is on and a client signs in
- **THEN** the client works as before

#### Scenario: A manager tries to change it
- **WHEN** a manager sends a change to the requirement
- **THEN** the API responds 403

### Requirement: A lost authenticator is replaced through a reset

An organization ADMIN SHALL be able to reset the second factor of another member of the organization, after a confirmation. The platform administrator SHALL be able to reset the second factor of any account by its email. A reset SHALL delete the secret, the backup codes and the trusted addresses and SHALL end the account's sessions. A reset by an organization admin SHALL be recorded in the organization's audit log; a reset by the platform administrator has no organization actor and is not. An admin SHALL NOT reset their own second factor this way. After a reset the member signs in with the password and can set it up again, and SHALL be made to when the organization requires it.

#### Scenario: An admin resets a manager
- **WHEN** an admin resets the second factor of a manager who lost their phone
- **THEN** the manager signs in with the password alone and can set it up again

#### Scenario: The admin's own
- **WHEN** an admin asks to reset their own second factor through the members endpoint
- **THEN** the API responds 403

#### Scenario: The platform administrator
- **WHEN** the platform administrator resets the second factor of `owner@acme.com`
- **THEN** that account signs in with the password alone

#### Scenario: Another organization
- **WHEN** an admin asks to reset the second factor of a member of another organization
- **THEN** the API responds 404
