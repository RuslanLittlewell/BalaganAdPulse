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
