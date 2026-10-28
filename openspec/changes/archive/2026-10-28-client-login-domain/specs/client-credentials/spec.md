## MODIFIED Requirements

### Requirement: The login is made from the client's name

A generated login SHALL consist of lowercase Latin letters, digits and hyphens followed by
`@balagan.pro`, and SHALL be unique among all accounts, both their logins and their emails.
It SHALL begin with the client's name written in Latin letters, Cyrillic transliterated,
shortened to at most twenty characters, then a hyphen and four random digits, and SHALL end
with `@balagan.pro`. A name with nothing to write SHALL begin with `client`. A login already
taken, as a login or as an email, SHALL be replaced by another without an error. The login
SHALL NOT become the account's email: the account keeps no email and receives no mail.

Logins issued before this rule SHALL gain the ending `@balagan.pro`, so every login has it.

#### Scenario: A Cyrillic name
- **WHEN** access is created for the client «Клиника Здоровье»
- **THEN** the login has the form `klinika-zdorove-` followed by four digits and
  `@balagan.pro`, and the account's email is empty

#### Scenario: A name with no letters
- **WHEN** access is created for a client named «24/7»
- **THEN** the login has the form `24-7-` followed by four digits and `@balagan.pro`, and for
  a client named «—» the form `client-` followed by four digits and `@balagan.pro`

#### Scenario: A login already taken
- **WHEN** the first login generated already belongs to another account
- **THEN** another is generated and access is created without an error

#### Scenario: A login equal to somebody's email
- **WHEN** the first login generated is the email of an existing account
- **THEN** another is generated and access is created without an error

#### Scenario: A login issued before
- **WHEN** the database holds a login issued without the ending
- **THEN** after the upgrade that login ends with `@balagan.pro` and signs in with the same
  password

### Requirement: Sign-in accepts an email or a login

The sign-in form SHALL ask for one value, «Email или логин», and a password. The value SHALL
be matched against account logins, and when no login matches, against account emails, both
without regard to letter case. A wrong value or password SHALL get the same answer as today,
which does not say which of the two was wrong. An account without an email SHALL NOT receive
a recovery message, and asking for one SHALL get the same answer as an unknown address.

#### Scenario: Signing in with a login
- **WHEN** a client types their login, `@balagan.pro` included, in capitals and the right
  password
- **THEN** they are signed in

#### Scenario: Signing in with an email
- **WHEN** a member types their email and the right password
- **THEN** they are signed in as before

#### Scenario: A wrong password for a login
- **WHEN** somebody types an existing login with a wrong password
- **THEN** the answer is the same one an unknown login gets

#### Scenario: An empty value
- **WHEN** the form is sent with the first field empty
- **THEN** the form says it must be filled and sends nothing

#### Scenario: Recovery for a login
- **WHEN** somebody asks for a recovery message for a client's login
- **THEN** the answer is the same one an unknown address gets and no message is sent
