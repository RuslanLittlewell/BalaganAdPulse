## ADDED Requirements

### Requirement: Admins and client admins import leads into a board

An `ADMIN` and a `CLIENT_ADMIN` SHALL be able to import leads into the CRM board of a project
they reach. Every other role SHALL be refused, and the CRM board SHALL show the import only to
the two roles that may use it. A board the member does not reach SHALL answer as missing. The
import SHALL add leads to the chosen board only.

#### Scenario: An admin imports
- **WHEN** an admin imports a table into a project's board
- **THEN** the leads appear on that board

#### Scenario: A client admin imports into their own project
- **WHEN** a client admin imports a table into a project of their own client
- **THEN** the leads appear on that board

#### Scenario: Another role
- **WHEN** a manager, a client, a guest or a partner sends an import
- **THEN** it is refused and no lead is created, and the board shows them no import button

#### Scenario: A board out of reach
- **WHEN** a client admin sends an import to a project of another client
- **THEN** it is refused as not found

### Requirement: A table comes from a CSV file or a Google Sheet

The import SHALL read a table from a CSV file the member picks or from the link of a Google Sheet
shared with anyone who has the link. A CSV file SHALL be read whether its values are separated
by commas, semicolons or tabs, with quoted values that hold separators, quotes or line breaks,
and with or without a byte order mark. A Google Sheet link SHALL be read from the tab the link
points to, or from the first tab when it names none. The first row SHALL be the column names.
A link that is not a Google Sheet, a sheet closed to link access, an empty table, a table with
more than 5000 rows and a file over 10 MB SHALL each be refused with a reason the member can
act on.

#### Scenario: A semicolon CSV
- **WHEN** the member picks a CSV file saved by Excel with semicolons and quoted values
- **THEN** the import shows its columns and rows as Excel showed them

#### Scenario: A Google Sheet link
- **WHEN** the member pastes the link of a sheet open to link access, pointing to its second tab
- **THEN** the import reads the second tab

#### Scenario: A closed sheet
- **WHEN** the member pastes the link of a sheet that is not shared by link
- **THEN** the import says the sheet must be opened to anyone with the link

#### Scenario: Not a Google Sheet
- **WHEN** the member pastes a link to any other site
- **THEN** the import refuses it without fetching the address

### Requirement: Each column gets a role the member can change

The import SHALL propose a role for every column from its name: the lead's name, phone, email,
submission date, campaign, status, one of the five UTM tags, the page, the referrer, the answer to
a question named by the column, or skipped. A column named like a technical field, such as a
click or browser identifier, an IP address or a consent flag, SHALL be proposed as skipped, and
a column with no known name SHALL be proposed as an answer. The member SHALL be able to change
any column's role before the import, and each role other than an answer or skipped SHALL be
held by at most one column.

#### Scenario: The Gealan sheet
- **WHEN** the member opens a table with the columns `name`, `email`, `phone`, `dt_created`, `status`, `utm_id`, `utm_source`, `fbclid` and a question column
- **THEN** they are proposed as the name, email, phone, submission date, status, campaign, UTM source, skipped and an answer

#### Scenario: A role changed
- **WHEN** the member makes another column the campaign column
- **THEN** the previous campaign column becomes skipped and the preview links leads by the new one

### Requirement: Imported leads are linked to the project's campaigns

Each imported lead SHALL be linked to a campaign of the board's project, so that the partners of
that campaign see it. The campaign SHALL be found from the value in the lead's campaign column,
or from its `utm_campaign` when that value is empty or no column is the campaign column. A value holding the external
ID of one of the project's campaigns SHALL link that campaign. A value holding the external ID
of an ad set or an ad of the project SHALL link the campaign that holds it, and an ad's ID SHALL
link the ad as well. Otherwise a value equal to the name of exactly one of the project's
campaigns, ignoring case and surrounding spaces, SHALL link that campaign. Before the import the
member SHALL see every value that matched no campaign, with the number of its leads, and SHALL
be able to pick a campaign of the project for it or leave its leads without a campaign. A
campaign picked for a value SHALL apply to all leads holding that value.

#### Scenario: A campaign ID
- **WHEN** a row's campaign column holds `120251441942930251`, the external ID of one of the project's campaigns
- **THEN** the lead is linked to that campaign

#### Scenario: An ad ID with a prefix
- **WHEN** a row's campaign column holds `ag:120251497757350251`, the external ID of an ad of the project
- **THEN** the lead is linked to that ad and to the campaign that holds it

#### Scenario: A campaign picked by hand
- **WHEN** two rows hold a value that matches no campaign and the member picks a campaign for it
- **THEN** both leads are linked to the picked campaign

#### Scenario: A partner sees the imported lead
- **WHEN** a lead is imported and linked to the campaign a partner works on
- **THEN** the partner sees the lead on the board

### Requirement: A status places the lead in a board column

A row's status SHALL place the lead in the board column it names. A status SHALL name a column
when it equals, ignoring case and surrounding spaces, the name of one of the board's own columns,
or the key, the Russian name or the English name of a fixed stage: `new`, «Новый», `qualified`,
«Квалифицированный», `target`, «Целевой», `proposal`, «КП», or the longer column titles such as
«Квал. лид» and «Qualified lead». A board's own column SHALL win over a fixed stage of the same
name. Before the import the member SHALL see every status of the table with the number of its
leads and the column it goes to: the column it names, or the first column when it names none. The
member SHALL be able to pick any board column for any status, and the pick SHALL apply to all leads
with that status. A row with an empty status SHALL land in the first column.

#### Scenario: A qualified lead
- **WHEN** a row's status is `Qualified`
- **THEN** the lead lands in the column «Квалифицированный»

#### Scenario: A board's own column
- **WHEN** the board has its own column «Замер» and a row's status is `замер`
- **THEN** the lead lands in «Замер»

#### Scenario: A status picked by hand
- **WHEN** rows hold the status `В работе`, which names no column, and the member picks «Целевой» for it
- **THEN** those leads land in «Целевой»

#### Scenario: A found column changed by hand
- **WHEN** the preview places the status `Qualified` in «Квалифицированный» and the member picks «КП» for it
- **THEN** the leads with that status land in «КП»

### Requirement: Duplicates are skipped and the preview says so

The import SHALL skip a row whose phone or email belongs to the contact of a lead already on the
board, a row whose phone or email repeats an earlier row of the same table, and a row with no
name, phone and email. Phones SHALL be compared by their digits and emails without regard to
case. Importing the same table again SHALL add nothing. Before the import the member SHALL see
how many leads will be added and how many rows will be skipped, split by reason, and after it how
many were added.

#### Scenario: A lead already on the board
- **WHEN** a row's phone matches the contact of a lead on the board that the Meta integration created
- **THEN** the row is skipped and counted as already on the board

#### Scenario: A row repeated in the table
- **WHEN** two rows carry the same email in different case
- **THEN** one lead is added

#### Scenario: The same table twice
- **WHEN** the member imports a table and then imports it again
- **THEN** the second import adds no lead

### Requirement: An imported lead keeps its details

An imported lead SHALL land in the column its status places it in, or in the board's first column
when it has no status, with the origin «Импорт» and at the top of that column. It SHALL take
the name from its row, or the phone or email when the name is empty, and SHALL be linked to a
contact of the project's client found by email or phone, or to a new one. It SHALL keep the
submission date from its row as the date the lead arrived, so that period filters and lead
counts place it on that date; a row with no readable date SHALL arrive at the time of the
import. It SHALL keep the UTM tags, the page, the referrer and every non-empty answer, cut to the
lengths a website lead allows. The board SHALL update for everyone watching it, and the import
SHALL be recorded once in the audit trail with the number of leads added.

#### Scenario: The lead card
- **WHEN** the member opens an imported lead
- **THEN** the card shows the origin «Импорт», the submission date, the UTM tags and the answers from the table

#### Scenario: A September lead
- **WHEN** a row dated 22 September 2026 is imported in November
- **THEN** the lead counts as arrived on 22 September 2026
