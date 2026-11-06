## ADDED Requirements

### Requirement: A project without an ad account points at connecting one

While a project has no Meta or Google connection, the "Добавить интеграцию" tile on its
page, which connects a Meta or Google account, SHALL carry the hint "Подключите рекламный кабинет: так появятся цифры".
It SHALL be shown only to an `ADMIN` or a `MANAGER`, and SHALL no longer be shown once the
project has a connection.

#### Scenario: Project with no account
- **WHEN** an admin opens a project with no ad account connected
- **THEN** the "Добавить интеграцию" tile carries the hint

#### Scenario: Account connected
- **WHEN** the project has a Meta connection
- **THEN** the hint is not shown
