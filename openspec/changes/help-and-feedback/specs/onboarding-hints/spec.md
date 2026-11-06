## ADDED Requirements

### Requirement: Closed hints can be shown again

The help and feedback dialog SHALL offer "Показать подсказки снова". Choosing it SHALL
forget every hint the signed-in person has closed on this device, close the dialog, and
let each hint show again wherever its condition still holds. Hints closed by another
person on the same device SHALL stay closed.

#### Scenario: Bring back the contact book hint
- **WHEN** an admin of a new organization closed the contact book hint and then chooses
  "Показать подсказки снова"
- **THEN** the hint on the contact book button shows again

#### Scenario: Another person's hints
- **WHEN** two people share a browser and one of them brings the hints back
- **THEN** the hints the other person closed stay closed
