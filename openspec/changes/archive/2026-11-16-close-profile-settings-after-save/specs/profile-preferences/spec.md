## ADDED Requirements

### Requirement: Successful saves close profile settings

Saving General or Account settings successfully SHALL close the profile dialog. Success notifications SHALL remain visible outside the closed dialog. Saving a changed language SHALL close the dialog before reloading the page. The dialog SHALL remain open while an account save is pending and when validation, storage or API errors prevent saving.

#### Scenario: Saving General
- **WHEN** a member saves General settings successfully
- **THEN** the dialog closes and the saved preferences are retained

#### Scenario: Saving Account
- **WHEN** the server confirms an Account save
- **THEN** the dialog closes and the success notification remains visible

#### Scenario: Changing the language
- **WHEN** a member saves a changed language
- **THEN** the dialog closes before the page reloads in the selected language

#### Scenario: A pending request
- **WHEN** an Account save has not yet finished
- **THEN** the dialog remains open until the request succeeds

#### Scenario: A refused save
- **WHEN** validation, browser storage or the API prevents saving
- **THEN** the dialog remains open with the error available to the member
