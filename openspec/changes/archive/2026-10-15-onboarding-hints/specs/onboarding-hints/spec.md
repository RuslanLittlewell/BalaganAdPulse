## Purpose

Onboarding hints point a person at the control they need next, and stay out of the way once
they have been read and closed.

## ADDED Requirements

### Requirement: A hint stays until it is closed

A hint SHALL appear next to the control it points at and SHALL stay visible until the person
closes it with its own close button. Clicking elsewhere or pressing Escape SHALL NOT close
it, and it SHALL NOT take the focus. Once closed, the hint SHALL NOT appear again for that
person in that browser.

#### Scenario: Closing a hint
- **WHEN** the person presses the hint's close button
- **THEN** the hint disappears and does not come back after a reload

#### Scenario: Clicking elsewhere
- **WHEN** the person clicks somewhere else on the page while a hint is shown
- **THEN** the hint stays

#### Scenario: Another person in the same browser
- **WHEN** a different person signs in after the first closed a hint
- **THEN** that person still sees the hint when it applies to them

### Requirement: A new organization's admin is pointed to the contact book

While an organization has no clients and no employees other than the signed-in admin, the
contact book button in the header SHALL carry the hint "Добавить сотрудников и клиентов —
тут". It SHALL be shown only to an organization `ADMIN`, SHALL be hidden while the contact
book is open, and SHALL no longer be shown once the organization has a client or another
employee.

#### Scenario: A fresh organization
- **WHEN** the first admin of an organization with no clients and no other employees opens
  the app
- **THEN** the contact book button carries the hint

#### Scenario: An organization with people
- **WHEN** the organization has a client or an employee besides the admin
- **THEN** no hint is shown

#### Scenario: Another role
- **WHEN** a manager, guest or customer opens the app of a fresh organization
- **THEN** no hint is shown
