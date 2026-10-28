# input-safety Specification

## Purpose
TBD - created by archiving change client-comments-and-input-safety. Update Purpose after archive.

## Requirements

### Requirement: Text from people is shown as text

Every value a person typed — a comment, a task title, a name, a contact detail, a lead's
field — SHALL be shown as text wherever it appears: in the web app, in Telegram messages and in
mail. Markup in it SHALL appear as the characters typed and SHALL NOT be interpreted.

#### Scenario: A comment carrying markup
- **WHEN** somebody comments `<img src=x onerror=alert(1)>`
- **THEN** the comment shows exactly those characters and no script runs

#### Scenario: A task title in Telegram
- **WHEN** a task titled `<b>Срочно</b>` is announced in Telegram
- **THEN** the message shows the angle brackets as typed

### Requirement: Rich text is checked by the API

A task's description, a project document's content and a monthly report's conclusions and plan
SHALL be accepted only as a rich-text document made of the parts the editors produce: a `doc`
of paragraphs, headings, quotes, lists, code blocks, rules and line breaks holding text, with
bold, italic, strike, code and — where the editor offers them — links, and, in a task's
description, its images. A part of an unknown type, an attribute holding anything but a plain
value, a document nested deeper than 100 levels, or a link to anything but an `http`, `https`,
`mailto` or `tel` address or a path SHALL be refused with 400 and nothing stored.

#### Scenario: A link that runs script
- **WHEN** a request saves a description with a link to `javascript:alert(1)`
- **THEN** the API responds 400 and the description is unchanged

#### Scenario: A link hidden behind whitespace
- **WHEN** a request saves a link to `java\tscript:alert(1)`
- **THEN** the API responds 400

#### Scenario: A part the editor does not make
- **WHEN** a request saves a description holding a node of type `iframe`
- **THEN** the API responds 400

#### Scenario: What the editor makes
- **WHEN** a member saves a description with a heading, a bulleted list, bold text, a link to
  `https://acme.by` and an image
- **THEN** it is stored and reads back unchanged

### Requirement: Text inputs are bounded

The API SHALL refuse with 400 a task title or checklist item over 500 characters, a client's
name or contact detail over 300 characters, a project's name, a document's title or a person's
name over 200 characters, and a phone or Telegram handle over 100 characters.

#### Scenario: A title too long
- **WHEN** a task is created with a 501-character title
- **THEN** the API responds 400 and no task is stored

### Requirement: Responses carry protective headers

Every response SHALL tell the browser not to guess content types (`X-Content-Type-Options:
nosniff`), not to show the app inside another site's frame (`X-Frame-Options: DENY` and a
`frame-ancestors 'none'` policy), to send only the origin as the referrer to other sites
(`Referrer-Policy: strict-origin-when-cross-origin`), and to load no plugins and keep the
document's base (`object-src 'none'; base-uri 'self'`).

#### Scenario: The app's page
- **WHEN** the browser loads the app or any API endpoint
- **THEN** the response carries those headers

### Requirement: Links to advertising sources are web addresses only

The preview of an ad SHALL link to its source only when the address is `http` or `https`.

#### Scenario: A source address with another scheme
- **WHEN** an imported creative's source address is not `http` or `https`
- **THEN** the preview offers no link to it
