## ADDED Requirements

### Requirement: The column chooser can be searched

The column chooser of every performance table SHALL open with a search field at its top, and
the field SHALL hold the focus. Typing SHALL narrow the listed columns to those whose name
contains the typed text, ignoring letter case and surrounding spaces; an empty field SHALL list
every column the chooser offers. When no column matches, the chooser SHALL say Ничего не
найдено and list no column. Typing SHALL keep the focus in the field and SHALL NOT move it to a
column whose name starts with the typed letter. The down arrow SHALL move the focus from the
field to the first listed column that can be changed. Turning a listed column on or off SHALL
keep the chooser open with the same text. Closing the chooser SHALL clear the text. The rule
that at least one figure column stays shown SHALL apply to the narrowed list as to the full one.

#### Scenario: Narrowing the list
- **WHEN** a member opens a table's column chooser and types cp
- **THEN** CPC, CPM and CPL are listed and Расход and Показы are not

#### Scenario: Letter case and spaces
- **WHEN** a member types " РАС " into the search field
- **THEN** Расход is listed

#### Scenario: Nothing matches
- **WHEN** a member types a text no column name contains
- **THEN** no column is listed and the chooser says Ничего не найдено

#### Scenario: Typing stays in the field
- **WHEN** a member opens the chooser and types Р
- **THEN** the search field holds Р and keeps the focus

#### Scenario: Turning a found column on
- **WHEN** a member types квал and turns on Квал. лид
- **THEN** the Квал. лид column is shown, and the chooser stays open with квал in the field

#### Scenario: Moving to the list by keyboard
- **WHEN** a member types cp and presses the down arrow
- **THEN** CPC receives the focus

#### Scenario: Opening again
- **WHEN** a member types cp, closes the chooser and opens it again
- **THEN** the search field is empty and every column is listed
