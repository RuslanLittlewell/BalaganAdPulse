## ADDED Requirements

### Requirement: The contact form collects an email and a phone

The landing's contact form SHALL ask for a required email address and an optional phone number besides the topic and message. The browser SHALL refuse to submit the form while the email is empty or malformed. The mail draft SHALL include the entered email and, when given, the phone. The page SHALL load the lead intake script so that a valid submission also reaches the CRM.

#### Scenario: A visitor leaves the email empty
- **WHEN** a visitor submits the contact form without an email
- **THEN** the form is not submitted and the email field is reported

#### Scenario: A visitor adds a phone
- **WHEN** a visitor fills the email and the phone and submits
- **THEN** the mail draft contains both values and the lead intake script receives them
