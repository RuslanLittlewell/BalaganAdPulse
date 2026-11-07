# lead-custom-fields Specification

## Purpose
Let each project board define its own lead fields, so a team records the facts its sales process needs in typed values instead of free text, and later views can show, sort and filter by them.

## Requirements

### Requirement: A board defines its own custom fields

Each project board SHALL hold its own ordered list of custom lead fields, and a field SHALL belong to exactly one board. A field SHALL have a name, a type and a place in the list. Field names SHALL be trimmed, nonblank, at most 50 characters, and unique on their board without regard to case. A name SHALL NOT equal, without regard to case, a built-in row of the lead card: Сумма сделки, Ответственный, Компания, Метки, Услуга, Номер телефона, Telegram, Мессенджер, Email, Сайт, Источник or Описание. A board SHALL hold at most 30 custom fields.

A member who may create leads on the board SHALL be able to create a field. A member who may update leads on the board SHALL be able to rename it, edit its options and move it. A member who may delete leads on the board SHALL be able to delete it. Every member who can read the board SHALL be able to list its fields. Requests from members who lack the needed permission SHALL be refused with 403, and requests naming a board the member cannot reach SHALL be refused with 404.

#### Scenario: Creating a field
- **WHEN** a member creates a field Бюджет of type Число on project A's board
- **THEN** Бюджет is listed last among project A's fields and appears on no other board

#### Scenario: A duplicate name
- **WHEN** a member names a field бюджет on a board that already has Бюджет, or names a field Источник
- **THEN** the API responds 400 and nothing changes

#### Scenario: The field limit
- **WHEN** a member creates a field on a board that already holds 30
- **THEN** the API responds 400 and nothing changes

#### Scenario: A guest
- **WHEN** a guest requests to create, rename or delete a field on a board they can read
- **THEN** the API responds 403 and nothing changes, while listing the fields succeeds

### Requirement: Seven field types with typed values

A field SHALL have one of seven types, and its values SHALL follow that type:

- Текст: trimmed text of at most 2000 characters.
- Число: a decimal number with an optional minus sign, at most 14 digits before the point and 4 after it, stored and exchanged as a string with four decimals and never as a float.
- Дата: a calendar day written `YYYY-MM-DD` that exists in the calendar.
- Список: the identifier of one of the field's options.
- Несколько из списка: a list of distinct identifiers of the field's options.
- Флажок: true or false.
- Ссылка: an HTTP or HTTPS address of at most 2048 characters.

An empty string, an empty list, false for Флажок, and null SHALL all mean that the lead has no value in the field. A field's type SHALL be fixed when the field is created, and a request to change it SHALL be refused with 400.

#### Scenario: A valid number
- **WHEN** a member stores -1500,5 in a Число field through the lead card
- **THEN** the lead stores -1500.5000 and the card shows -1500.5

#### Scenario: A value of the wrong type
- **WHEN** a request stores the text много in a Число field, the day 2026-02-30 in a Дата field, or an option of another field in a Список field
- **THEN** the API responds 400 and the lead is unchanged

#### Scenario: Changing the type
- **WHEN** a request changes the type of a Текст field to Число
- **THEN** the API responds 400 and the field is unchanged

#### Scenario: An unchecked checkbox
- **WHEN** a member unchecks a Флажок field and saves
- **THEN** the lead has no value in that field and the card shows the box unchecked

### Requirement: List fields carry colored options

A Список or Несколько из списка field SHALL carry between 1 and 50 options in a stored order. An option SHALL have a name that is trimmed, nonblank, at most 50 characters and unique within its field without regard to case, and a color chosen from the palette серый, красный, оранжевый, жёлтый, зелёный, бирюзовый, синий and фиолетовый. An option SHALL keep its identity when it is renamed, recolored or moved, so leads that hold it keep holding it. Removing an option SHALL clear it from every lead of the board in the same transaction. Fields of other types SHALL carry no options.

#### Scenario: Renaming an option
- **WHEN** a member renames the option Малый to Small in a Список field that three leads hold
- **THEN** the three leads show Small and no lead value changes

#### Scenario: Removing an option
- **WHEN** a member removes the option VIP from a Несколько из списка field, and a lead holds VIP and Опт
- **THEN** that lead holds only Опт

#### Scenario: A list field without options
- **WHEN** a request creates a Список field with no options, or with the options Опт and опт
- **THEN** the API responds 400 and no field is created

### Requirement: Fields keep a stable order

A newly created field SHALL be placed last. A member who may update leads SHALL be able to move a field to any place in its board's list, and the other fields SHALL keep their relative order. The order SHALL stay contiguous after creating, moving and deleting fields, including under concurrent requests. An out-of-range positive place SHALL move the field last; a negative or noninteger place SHALL be refused with 400.

#### Scenario: Moving a field up
- **WHEN** a member moves the third of three fields one place up
- **THEN** it becomes second and the former second becomes third

#### Scenario: Deleting closes the gap
- **WHEN** a member deletes the first of three fields
- **THEN** the remaining two are first and second in their previous order

### Requirement: Deleting a field removes its values

Deleting a field SHALL require confirmation that states how many leads on the board hold a value in it. A confirmed deletion SHALL remove the field and its values from every lead of the board in the same transaction. A canceled deletion SHALL change nothing.

#### Scenario: Confirming deletion
- **WHEN** a member deletes the field Бюджет that four leads hold a value in
- **THEN** the confirmation says four leads hold a value, and after confirming, no lead holds a Бюджет value and the field is gone from the lead card

#### Scenario: Canceling deletion
- **WHEN** a member cancels deleting a field
- **THEN** the field and every value in it are unchanged

### Requirement: Lead values are read and written through the lead

A lead SHALL report its custom values as a set keyed by field identifier that holds only the fields with a value. Creating a lead SHALL accept values for any of the board's fields. Updating a lead SHALL change only the fields named in the request: null or an empty value SHALL clear a field, and fields not named SHALL keep their values. A request naming a field that does not belong to the lead's board SHALL be refused with 400, and a refused request SHALL change no value. A lead imported from Meta SHALL arrive with no custom values, and its values SHALL be editable afterward under the existing permissions.

#### Scenario: A partial update
- **WHEN** a lead holds Бюджет 1000 and Сегмент Опт, and a request updates only Бюджет to 2000
- **THEN** the lead holds Бюджет 2000 and Сегмент Опт

#### Scenario: Clearing a value
- **WHEN** a request sets Сегмент to null
- **THEN** the lead no longer reports a Сегмент value

#### Scenario: A field of another board
- **WHEN** a request on project A's board names a field of project B's board
- **THEN** the API responds 400 and the lead is unchanged

#### Scenario: An imported lead
- **WHEN** a lead arrives from a Meta form on a board with custom fields
- **THEN** it holds no custom values until a member fills them in

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

### Requirement: Field changes are audited and synchronized

Creating, renaming, moving, editing the options of and deleting a field SHALL each record its actor, board, field and changes in an audit event committed with the change, and a failed request SHALL record nothing. Deleting a field or removing an option SHALL record which leads lost a value. Open boards of members who can read the board SHALL refresh their fields and leads after a committed change, and the notification SHALL carry no field names, option names or lead values.

#### Scenario: Another member adds a field
- **WHEN** a member adds a field while another member has the same lead card open
- **THEN** the other member's card shows the new field without a manual reload

#### Scenario: A refused change
- **WHEN** creating a field is refused
- **THEN** no audit event is recorded and no board refreshes
