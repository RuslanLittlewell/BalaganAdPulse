## ADDED Requirements

### Requirement: A person carries the ways of reaching them

A person SHALL carry an optional phone number and an optional Telegram handle beside
their name and email. Both SHALL be offered at registration and SHALL be editable
afterwards by that person, in the same place they change the rest of their profile.

Neither SHALL be required: an account is not worth refusing over a missing phone number,
and a person who has not given one is shown as having none rather than as having a blank.

Wherever people are listed for the purpose of reaching them — the agency's employee
directory, and a client's own company — both SHALL be shown.

#### Scenario: Registering with them

- **WHEN** a visitor completes any registration form having filled the phone and Telegram
- **THEN** both are stored against the account and shown wherever that person is listed

#### Scenario: Registering without them

- **WHEN** a visitor completes a registration form leaving both empty
- **THEN** the account is created, and the person is listed with no phone and no Telegram

#### Scenario: Changing them later

- **WHEN** a member edits their phone or Telegram in profile settings
- **THEN** the change is stored and shown wherever they are listed

#### Scenario: A directory shows how to reach somebody

- **WHEN** a member opens the employee directory, or a customer opens their company
- **THEN** each person is shown with their email, phone and Telegram, and a missing one
  reads as absent rather than as an empty space

#### Scenario: Nobody edits somebody else's

- **WHEN** a member tries to change another person's phone or Telegram
- **THEN** the API refuses: these belong to the person, not to the directory
