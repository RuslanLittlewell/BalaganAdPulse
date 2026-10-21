## ADDED Requirements

### Requirement: The participant and project filters offer a Все entry

The participant filter and the project filter of the tasks screen SHALL each list a **Все**
entry above their other entries. Choosing it SHALL choose every entry of that filter at once;
choosing it while every entry is chosen SHALL clear the filter. It SHALL be marked chosen
exactly while every entry of its own filter is chosen, and unmarked otherwise. The entry of
one filter SHALL NOT change the choice of the other.

#### Scenario: Choosing every participant at once

- **WHEN** a member opens the participant filter with nobody chosen and chooses **Все**
- **THEN** every participant listed, including **Без участников** when offered, is chosen

#### Scenario: Choosing every project at once

- **WHEN** a member opens the project filter with one project chosen and chooses **Все**
- **THEN** every project listed, including **Без проекта** when offered, is chosen

#### Scenario: Clearing through Все

- **WHEN** every entry of a filter is chosen and the member chooses **Все**
- **THEN** nothing is chosen in that filter

#### Scenario: Все follows the entries

- **WHEN** every entry of a filter is chosen one by one
- **THEN** **Все** is marked, and unchoosing any entry unmarks it

#### Scenario: The two filters are independent

- **WHEN** a member chooses **Все** in the participant filter
- **THEN** the project filter keeps whatever was chosen in it
