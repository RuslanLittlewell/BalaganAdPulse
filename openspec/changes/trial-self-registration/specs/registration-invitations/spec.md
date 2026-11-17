## MODIFIED Requirements

### Requirement: An invitation link is the only way in

The interface SHALL offer no way to join an existing organization other than following an invitation link. The one other way in is the trial signup, which creates a new organization rather than joining one.
There SHALL be no screen asking a visitor to type an invitation code, and the sign-in
screen SHALL NOT offer to join an organization; it MAY link to the trial page.

The API SHALL continue to refuse a registration carrying no invitation code, or one that
cannot be redeemed. Removing the screen removes a way to ask, not the rule.

An address that named the removed screen SHALL lead to the sign-in form rather than to a
blank page.

#### Scenario: Nothing offers to create an account

- **WHEN** a signed-out visitor opens the sign-in screen
- **THEN** it offers no invitation-code screen, and its only link to registering leads to the trial page

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
