# project-documents Specification

## Purpose
TBD - created by archiving change document-previews. Update Purpose after archive.

## Requirements

### Requirement: The notebook fills the page
The notebook SHALL take the height left on the project page below its tabs, so the list of
documents and the divider beside it reach the bottom of the page, and SHALL grow with a long
document instead of cutting it off.

#### Scenario: A tall screen
- **WHEN** a member opens the notebook of a project with two short documents on a tall screen
- **THEN** the list's column reaches the bottom of the page

### Requirement: Documents are previewed while none is open
With no document open and at least one document in the project, the notebook SHALL show a
preview card for every document, in the order of the list. A card SHALL show a thumbnail of
the document's first page — its title, the date of its last change with who made it, and the
beginning of its text — and under it the document's title and how long ago it was last
changed, as in 5 минут назад, 3 часа назад or вчера, giving the date once it is more than a week
old. Choosing a card SHALL open its document. A document without text SHALL show its thumbnail
without lines of text.

The list of documents from the API SHALL carry for each document an excerpt: the beginning of
its text as plain lines, one per paragraph, heading or list item, at most 280 characters and
ending in an ellipsis when cut, and empty for a document without text. The list SHALL still not
carry the documents' full text.

#### Scenario: Previews of three documents
- **WHEN** a member opens the notebook of a project holding О проекте, Стратегия and Конкуренты
- **THEN** three preview cards are shown in that order, each with its title and how long ago it changed

#### Scenario: Opening from a preview
- **WHEN** the member chooses the Стратегия card
- **THEN** Стратегия opens and the list marks it as open

#### Scenario: The excerpt in the list
- **WHEN** a document holds a heading Коротко followed by a paragraph Почти все агентства строят анализ
- **THEN** the list gives it the excerpt Коротко and Почти все агентства строят анализ on two lines

#### Scenario: A long text
- **WHEN** a document's text runs to two thousand characters
- **THEN** its excerpt holds the first 280 characters at most and ends in an ellipsis

### Requirement: An open document leads back to the previews
An open document SHALL show, before its title, a back arrow named К документам that closes the
document and returns to the previews, keeping the period in the address and saving any change
not yet saved, as leaving the document does. A document that is not found SHALL offer the same
way back.

#### Scenario: Back from a document
- **WHEN** a member who opened Стратегия from its preview chooses К документам
- **THEN** the notebook shows the previews again and its address names no document

#### Scenario: A change not yet saved
- **WHEN** a manager renames a document and chooses К документам before the change is saved
- **THEN** the new title is saved and the previews show it

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
