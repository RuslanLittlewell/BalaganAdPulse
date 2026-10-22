## ADDED Requirements

### Requirement: Selects that offer projects can be searched

Every select that offers the projects to choose from SHALL show a search field at the top of its
list. The field SHALL be focused when the list opens and SHALL narrow the options to those whose
name contains the typed text, ignoring case and surrounding spaces. Options that stand for
no particular project, such as All projects, SHALL be left out while the member searches. Enter
SHALL choose the first matching option, and a search matching nothing SHALL say so. The search
SHALL be empty each time the list opens.

#### Scenario: Narrowing the options
- **WHEN** a member opens the report filter and types ром
- **THEN** only the projects whose name contains ром are listed

#### Scenario: Choosing the first match
- **WHEN** the member presses Enter after typing
- **THEN** the first matching project is chosen and the list closes

#### Scenario: Nothing matches
- **WHEN** the member types text that no project name contains
- **THEN** the list says that nothing was found and Enter chooses nothing

#### Scenario: A fresh search
- **WHEN** the member closes the list with a query typed and opens it again
- **THEN** the search field is empty and every option is listed
