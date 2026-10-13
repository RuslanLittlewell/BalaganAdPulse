## Purpose

Give every project an internal notebook of rich-text documents — what the project is, its
strategy, its competitors — kept by the agency beside the project's figures.

## ADDED Requirements

### Requirement: A project page is split into the project and its documents
A project page SHALL show, under its header, tabs named Проект and Документы. Проект SHALL
hold everything the project page shows. Документы SHALL hold the project's notebook. Each
tab SHALL have its own address, and an opened document SHALL have its own address within the
notebook, so a tab or a document can be reloaded and linked to. Switching tabs SHALL keep the
selected period. A member who may not read documents SHALL see no tabs, only the project.

#### Scenario: Opening the notebook
- **WHEN** a manager chooses Документы on a project page
- **THEN** the address ends in the project's documents, the notebook is shown and the
  campaigns are not

#### Scenario: Back to the project
- **WHEN** the manager chooses Проект
- **THEN** the project's figures are shown again for the same period

#### Scenario: A customer
- **WHEN** a client opens a project page
- **THEN** no tabs are shown

### Requirement: The notebook lists the project's documents
The notebook SHALL list every document of the project, in the order they were created, each
with its title and when it was last changed. Choosing a document SHALL open it beside the
list. With no document open, the notebook SHALL invite the member to create one if they may,
and say there are no documents yet when there are none.

#### Scenario: Three documents
- **WHEN** a manager created О проекте, Стратегия and Конкуренты in that order
- **THEN** the notebook lists them in that order, each with when it was last changed

#### Scenario: Opening a document
- **WHEN** a member chooses Стратегия in the list
- **THEN** its title and text are shown beside the list and the list marks it as open

### Requirement: Documents are created with a title
A member who may write documents SHALL create one from the notebook's Добавить документ
control, naming it in a dialog titled Новый документ. The title SHALL be required, SHALL be
trimmed and SHALL be at most 120 characters. A new document SHALL start with no text and
SHALL open at once.

#### Scenario: Creating a document
- **WHEN** a manager creates a document named «О проекте»
- **THEN** it appears in the list and opens, empty, with that title

#### Scenario: A blank title
- **WHEN** a manager tries to create a document whose title is blank
- **THEN** nothing is created and the field says a title is needed

### Requirement: A document is edited in place and saves itself
A document SHALL hold a title and rich text with headings of three levels, paragraphs,
bold, italic and struck-through text, bulleted and numbered lists, quotes and links. A member
who may write documents SHALL change the title and the text in place; each change SHALL be
saved on its own shortly after the member stops typing, and SHALL also be saved when they
leave the document. The document SHALL say whether its latest change is being saved, has been
saved or could not be saved, and SHALL show when and by whom it was last changed. When two
members change the same document, the change saved last SHALL replace the other. The text
SHALL be stored as a structured document of at most one megabyte; any other text SHALL be
refused with 400, and a request too large to read at all with 413.

#### Scenario: Typing
- **WHEN** a manager types a paragraph into a document and stops
- **THEN** the paragraph is saved without any save control, and reloading shows it

#### Scenario: Renaming
- **WHEN** a manager changes a document's title to «Стратегия на Q4»
- **THEN** the list shows the new title

#### Scenario: Two editors
- **WHEN** two managers edit the same document and the second saves after the first
- **THEN** the document holds the second manager's version

#### Scenario: A save that fails
- **WHEN** a change cannot be saved
- **THEN** the document says the change was not saved and keeps the text on screen

### Requirement: Deleting a document is confirmed
A member who may write documents SHALL delete a document from the open document, after
confirming in a dialog. A deleted document SHALL be gone for good and the notebook SHALL
return to its list.

#### Scenario: Confirming
- **WHEN** a manager deletes «Конкуренты» and confirms
- **THEN** it disappears from the list and its address answers that it does not exist

#### Scenario: Declining
- **WHEN** the manager declines the confirmation
- **THEN** the document stays

### Requirement: Documents belong to the agency
Documents SHALL be read by every `ADMIN`, `MANAGER` and `GUEST` who reaches the project, and
created, changed and deleted by every `ADMIN` and `MANAGER` who reaches it. A `GUEST` SHALL
see documents read-only, with no control to create, change or delete. A `CLIENT` or
`CLIENT_ADMIN` SHALL NOT reach documents: the API SHALL answer 403. A project the member does
not reach, and a document of another project, SHALL answer 404.

#### Scenario: A guest
- **WHEN** a guest who reaches the project opens a document
- **THEN** its text is shown and cannot be changed, and no control creates or deletes one

#### Scenario: A guest writing through the API
- **WHEN** a guest asks the API to change a document
- **THEN** the API responds 403 and the document is unchanged

#### Scenario: A client
- **WHEN** a client asks the API for their project's documents
- **THEN** the API responds 403

#### Scenario: Another project's document
- **WHEN** a manager asks for a document through a project it does not belong to
- **THEN** the API responds 404

### Requirement: Documents are part of the project's activity
Creating, renaming and deleting a document SHALL each record one audit event in the
project's context, naming the document as it was titled at the time. Changes to a
document's text SHALL NOT be recorded, since every pause in typing saves one.

#### Scenario: The activity of a project
- **WHEN** a manager creates «О проекте», renames it «О клиенте» and deletes it
- **THEN** the project's activity shows three events, one for each, and none for the text
