# client-credentials Specification

## Purpose
TBD - created by archiving change client-cabinet-credentials. Update Purpose after archive.

## Requirements

### Requirement: An admin creates a client's cabinet access

An agency `ADMIN` SHALL be able to create cabinet access for a client of their organization
that has none. The backend SHALL generate the login and the password; the caller SHALL NOT
choose either. Creating access SHALL create, together or not at all, an account named after
the client with no email, a membership of the organization with the role `CLIENT_ADMIN`, and
that membership's reach over the client. The answer SHALL carry the login and the password.

A client SHALL have at most one cabinet access created this way.

#### Scenario: An admin creates access
- **WHEN** an admin creates cabinet access for a client of their organization
- **THEN** the answer carries a login and a password, and signing in with them opens that
  client's cabinet as its principal, reaching its projects and nothing of another client

#### Scenario: Access already exists
- **WHEN** an admin creates cabinet access for a client that already has it
- **THEN** the API responds 409 and the existing login and password are unchanged

#### Scenario: A client of another organization
- **WHEN** an admin creates cabinet access naming a client of another organization
- **THEN** the API responds 404 and no account is created

#### Scenario: Somebody other than an admin
- **WHEN** a manager, a guest or a customer tries to create, read or replace a client's
  cabinet access
- **THEN** the API refuses with 403, or with 404 for a client they do not reach, and nothing
  changes

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

### Requirement: The password is generated and can be shown again

A generated password SHALL be twelve characters drawn at random from Latin letters and
digits, leaving out characters easily confused with one another. The backend SHALL keep it
encrypted so it can be shown again, and SHALL sign in by its hash alone. An admin SHALL be
able to read the login and the password of a client's access at any later time. Reading a
client that has no access SHALL answer that there is none.

#### Scenario: Reading access later
- **WHEN** an admin reads a client's cabinet access some time after creating it
- **THEN** the answer carries the same login and password that creation returned

#### Scenario: A client without access
- **WHEN** an admin reads the cabinet access of a client that has none
- **THEN** the answer says there is none

#### Scenario: The password is not stored readable
- **WHEN** the stored account is inspected in the database
- **THEN** neither its password hash nor its kept copy contains the password

### Requirement: An admin can issue a new password

An admin SHALL be able to issue a new password for a client's existing cabinet access. The
login SHALL stay. The old password SHALL stop signing in, and every session the account
holds SHALL end. Issuing a password for a client without access SHALL answer 404.

#### Scenario: A new password
- **WHEN** an admin issues a new password
- **THEN** the answer and later reads carry the new password and the same login, the new
  password signs in, the old one is refused, and the account's open sessions can no longer
  be refreshed

#### Scenario: No access to replace
- **WHEN** an admin issues a new password for a client without cabinet access
- **THEN** the API responds 404

### Requirement: A password the holder sets is not kept

When the holder of a cabinet account sets a password of their own — in their profile or
through password recovery — the kept copy of the issued password SHALL be dropped. Reading
the access afterwards SHALL return the login and say that the client changed the password,
without a password. An admin SHALL still be able to issue a new one.

#### Scenario: The client changes the password
- **WHEN** the client changes their password in their profile and an admin then reads the
  access
- **THEN** the answer carries the login, no password, and says the client changed it

#### Scenario: Issuing after the client changed it
- **WHEN** an admin issues a new password after the client changed theirs
- **THEN** the new password is kept and shown again as before

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

### Requirement: An account without an email shows its login

Wherever the interface shows the signed-in account's email — the user menu and the profile —
an account without one SHALL show its login instead. API answers that describe a person
SHALL carry `email: null` for such an account rather than a made-up address.

#### Scenario: The client opens the user menu
- **WHEN** a client signed in with a login opens the user menu
- **THEN** it shows their name and their login

### Requirement: The client's card offers cabinet access to admins

The contact book's card of a client SHALL show a «Доступ в кабинет» section to admins
alone. Without access it SHALL offer to create it. With access it SHALL show the login and
the password, the password hidden until asked for, each with a way to copy it, and SHALL
offer a new password after a confirmation that warns the old one stops working. When the
client changed the password, it SHALL say so in place of the password and still offer a new
one. Managers SHALL see no such section.

#### Scenario: An admin creates access from the card
- **WHEN** an admin opens a client without access and chooses «Создать доступ»
- **THEN** the card shows the generated login and the hidden password

#### Scenario: Revealing and copying
- **WHEN** the admin asks to show the password, then copies it
- **THEN** the password is shown and put on the clipboard

#### Scenario: A new password from the card
- **WHEN** the admin chooses «Новый пароль» and confirms
- **THEN** the card shows the new password, and nothing changes if they cancel instead

#### Scenario: The client changed it
- **WHEN** an admin opens a client whose holder changed the password
- **THEN** the card shows the login, says the client changed the password, and offers a new
  one

#### Scenario: A manager opens the card
- **WHEN** a manager opens a client's card
- **THEN** no cabinet access section is shown

### Requirement: The account goes with its client

Deleting a client SHALL delete the account created for its cabinet access, so its login
stops signing in. Removing that account's membership SHALL leave the client without access,
so an admin can create it again.

#### Scenario: Deleting the client
- **WHEN** an admin deletes a client that has cabinet access
- **THEN** its login no longer signs in

#### Scenario: Removing the membership
- **WHEN** the membership of a client's cabinet account is removed
- **THEN** reading the client's access says there is none, and creating it again succeeds

### Requirement: Cabinet access is recorded in the activity log

Creating access and issuing a new password SHALL each add an activity event on the client,
naming the client and never the password.

#### Scenario: The log after access is created
- **WHEN** an admin creates access and later issues a new password
- **THEN** the client's activity log shows both, under the admin's name, with no password in
  either
