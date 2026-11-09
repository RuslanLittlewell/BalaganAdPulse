## Purpose

Give a lead a running thread of comments, so members record what was said and agreed without overwriting the lead's description.

## ADDED Requirements

### Requirement: A lead has notes

A member who reaches a lead SHALL be able to read its notes, oldest first. A member who may update leads SHALL be able to add a note of up to 5000 characters. A blank note SHALL be refused. Each note SHALL show its author's name, its text and when it was written. A note SHALL be written text that may tag people. The author of a note SHALL be able to edit it, and the note SHALL then show that it was edited. The author of a note and an admin SHALL be able to delete it; nobody else SHALL. A note SHALL be deleted with its lead. A lead that the member cannot reach SHALL answer 404 on every note request. The notes SHALL be independent of the lead's Описание field, which stays as it is.

#### Scenario: Writing a note
- **WHEN** a manager writes a note on a lead
- **THEN** it appears at the end of the lead's notes with the manager as author

#### Scenario: Editing someone else's note
- **WHEN** a manager edits a note written by another member
- **THEN** the API responds 403 and the note is unchanged

#### Scenario: An admin deletes a note
- **WHEN** an admin deletes a note written by a manager
- **THEN** the note is removed

#### Scenario: A blank note
- **WHEN** a member sends a note of spaces only
- **THEN** the API responds 400 and nothing is stored

#### Scenario: A guest
- **WHEN** a guest opens the Заметки tab
- **THEN** the notes are listed and no input is shown

### Requirement: Notes are edited in the Заметки tab

The Заметки tab of the lead panel SHALL list the notes, oldest first, and SHALL show an input below them for a member who may update leads. Sending SHALL add the note and clear the input. A refused save SHALL keep the typed text and show the error. A lead without notes SHALL show a quiet empty message. A note added or changed in another session SHALL appear without a reload.

#### Scenario: Sending a note
- **WHEN** a manager types a text in the input and presses send
- **THEN** the note appears in the list and the input is empty

#### Scenario: A refused note
- **WHEN** the API refuses a note
- **THEN** the typed text stays in the input and the reason is shown

### Requirement: A note can tag people

Typing `@` in a note's field SHALL offer the active members of the organization other than the author, and the people of the lead's client who reach the lead's project, narrowed as more is typed. Choosing a person SHALL put their name in the note as a tag. A saved note SHALL show each tag marked. A request that tags someone who is not an active member of the organization SHALL be refused with 400, and so SHALL one that tags a client's person who does not reach the lead's project. Editing a note SHALL allow changing its tags. A person tagged by name that the text no longer holds SHALL be dropped from the tags when the note is saved.

#### Scenario: Tagging a colleague
- **WHEN** a manager types `@Бор` in a note, chooses Борис from the offer and sends it
- **THEN** the note shows Борис marked as a tag

#### Scenario: Tagging a client's person
- **WHEN** a manager tags a person of the lead's client who reaches the project
- **THEN** the person is offered and tagged like a colleague

#### Scenario: Tagging a client's person who does not reach the project
- **WHEN** a request tags a client's person who has no access to the lead's project
- **THEN** the API responds 400 and no note is stored

#### Scenario: Tagging a stranger
- **WHEN** a request tags someone who is not a member of the organization
- **THEN** the API responds 400

### Requirement: A tagged person is notified of the note

A member tagged in a note, other than its author, SHALL receive a notification that reads Вас упомянули в заметке к лиду «name». Choosing it SHALL mark it read and open the lead's board with the lead's panel open at Заметки. Editing a note SHALL notify only the people newly tagged. A tagged person who no longer reaches the lead SHALL not see the notification. The notification SHALL reach the person's Telegram chat by the rules of telegram-notifications.

#### Scenario: Being tagged
- **WHEN** a manager tags Борис in a note
- **THEN** Борис's notifications list a mention in the lead's note, and choosing it opens the lead

#### Scenario: Tagging oneself
- **WHEN** a member tags themselves
- **THEN** they receive no notification

#### Scenario: Editing a note
- **WHEN** the author edits a note that tagged Борис and adds Анну
- **THEN** only Анна is notified

### Requirement: The note field is one line high

The note field SHALL start at one line, grow with its text up to a limit and then scroll, and SHALL hold the send control at its right, level with the first line. Enter SHALL send the note and Shift+Enter SHALL start a new line. While the offer of people to tag is open, Enter SHALL choose the highlighted person. Enter SHALL send nothing while the field holds only spaces.

#### Scenario: A quiet field
- **WHEN** a member opens Заметки on a lead without notes
- **THEN** the field is one line high

#### Scenario: Choosing a person with Enter
- **WHEN** the offer of people is open and a member presses Enter
- **THEN** the highlighted person is tagged and nothing is sent
