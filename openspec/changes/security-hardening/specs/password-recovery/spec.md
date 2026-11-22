## MODIFIED Requirements

### Requirement: Setting a new password signs out everywhere else

Setting a new password with a working link SHALL replace the account's password, SHALL end
every session the account had, SHALL lift any lock on password sign-in, and SHALL sign the
visitor in with a new one, taking them into the app. Afterwards the old password SHALL NOT sign in and the new one SHALL.

#### Scenario: Resetting the password

- **WHEN** a visitor sets a new password through a working link
- **THEN** they are signed in and taken into the app, the old password no longer signs in,
  and the new one does

#### Scenario: A locked account

- **WHEN** an account whose sign-in requires a reset sets a new password through a link
- **THEN** it can sign in with the new password

#### Scenario: Other sessions end

- **WHEN** the account was signed in on another device before the reset
- **THEN** that device's session can no longer be renewed
