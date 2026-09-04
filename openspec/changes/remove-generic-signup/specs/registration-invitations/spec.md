## ADDED Requirements

### Requirement: An invitation link is the only way in

The interface SHALL offer no way to register other than following an invitation link.
There SHALL be no screen asking a visitor to type an invitation code, and the sign-in
screen SHALL NOT offer to create an account.

The API SHALL continue to refuse a registration carrying no invitation code, or one that
cannot be redeemed. Removing the screen removes a way to ask, not the rule.

An address that named the removed screen SHALL lead to the sign-in form rather than to a
blank page.

#### Scenario: Nothing offers to create an account

- **WHEN** a signed-out visitor opens the sign-in screen
- **THEN** it offers no link to a registration screen

#### Scenario: A bookmark for the removed screen

- **WHEN** somebody opens `/signup`
- **THEN** they are taken to the sign-in form

#### Scenario: Registering by invitation still works

- **WHEN** a visitor follows a valid invitation link and completes the form it shows
- **THEN** the account is created as before

#### Scenario: The rule is unchanged

- **WHEN** a registration is sent with no invitation code, or with one that cannot be
  redeemed
- **THEN** the API refuses it exactly as it did before
