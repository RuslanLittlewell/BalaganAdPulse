## MODIFIED Requirements

### Requirement: A document is edited in place and saves itself
A document SHALL hold a title and rich text with headings of three levels, paragraphs,
bold, italic and struck-through text, bulleted and numbered lists, quotes and links. A member
who may write documents SHALL change the title and the text in place; each change SHALL be
saved on its own shortly after the member stops typing, and SHALL also be saved when they
leave the document. The document SHALL say whether its latest change is being saved, has been
saved or could not be saved, and SHALL show when and by whom it was last changed. Every update SHALL carry its expected revision. A stale revision SHALL be refused with 409, preserving the local draft until the member explicitly resolves the conflict. The text
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
- **THEN** the second save is refused with a conflict and its draft stays available for explicit resolution

#### Scenario: A save that fails
- **WHEN** a change cannot be saved
- **THEN** the document says the change was not saved and keeps the text on screen

