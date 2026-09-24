## ADDED Requirements

### Requirement: Creating and deleting a lead are confirmed
A lead stored through Создать SHALL raise the success alert Лид создан, and a lead deleted through the card SHALL raise the success alert Лид удалён, each announced as a status outside the card. A refused create or delete SHALL raise its error alert instead and no success alert.

#### Scenario: A lead is created
- **WHEN** a member creates a lead from the card
- **THEN** the alert Лид создан is shown

#### Scenario: A lead is deleted
- **WHEN** a member confirms deleting a lead
- **THEN** the card closes and the alert Лид удалён is shown

#### Scenario: A refused create
- **WHEN** creating a lead is refused
- **THEN** the error is shown and Лид создан is not
