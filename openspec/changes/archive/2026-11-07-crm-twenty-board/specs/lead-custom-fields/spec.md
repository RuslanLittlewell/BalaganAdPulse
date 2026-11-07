## MODIFIED Requirements

### Requirement: The Поля dialog manages a board's fields

The view bar's Настройки SHALL offer Поля доски to members who may create leads on the selected board. It SHALL open a dialog that lists the board's fields in order, each with its name and type, and SHALL offer, as permissions allow: Добавить поле, editing a field's name and options, moving a field up or down, and deleting a field. Adding a field SHALL ask for a name and a type, and for a list type SHALL ask for at least one option with its color. The form SHALL keep entered values and show the reason when the API refuses them. Changing the selected board SHALL close the dialog.

#### Scenario: Adding a list field
- **WHEN** a member opens Поля доски, adds the field Сегмент of type Список with the options Опт and Розница, and saves
- **THEN** the dialog lists Сегмент with its type, and the side panel offers Опт and Розница for it

#### Scenario: A refused name
- **WHEN** a member adds a field named Компания
- **THEN** the dialog stays open with the name still entered and shows why it was refused

#### Scenario: No control for guests
- **WHEN** a guest opens Настройки
- **THEN** Поля доски is not offered

### Requirement: The lead card edits custom values by type

The side panel's Свои поля group SHALL show each of the board's custom fields as a labelled row, in the board's order. Each row SHALL be edited in place with an editor that matches its type:
- a text input for Текст;
- a decimal input for Число;
- a date picker for Дата;
- a single choice for Список;
- a multiple choice for Несколько из списка;
- a checkbox for Флажок;
- an address input for Ссылка.

Each value SHALL be stored on its own, the way the side panel stores every value. List values SHALL show each option's name in its color. A stored Ссылка value SHALL be openable in a new tab without giving the opened page access to the application. An invalid value SHALL keep its editor open with the reason beside it and store nothing. Members who may not edit leads SHALL see every value and no editor. A board card SHALL show a custom value only when its field is chosen under Поля карточки.

#### Scenario: Editing values in the card
- **WHEN** a member opens a lead on a board with the fields Бюджет and Встреча, enters 5000 in Бюджет and presses Enter, then picks 12.11.2026 in Встреча
- **THEN** each value is stored as it is entered, and reopening the lead shows Бюджет 5000 and Встреча 12.11.2026 under Свои поля

#### Scenario: An invalid value
- **WHEN** a member enters abc in a Число field and presses Enter
- **THEN** the editor stays open with abc still entered and an error beside it, and nothing is stored

#### Scenario: A read-only member
- **WHEN** a guest opens a lead holding a Ссылка value
- **THEN** the value is shown, can be opened in a new tab, and cannot be edited

#### Scenario: A custom value on the card
- **WHEN** Бюджет is not chosen under Поля карточки
- **THEN** no board card shows a Бюджет value, even for leads that hold one
