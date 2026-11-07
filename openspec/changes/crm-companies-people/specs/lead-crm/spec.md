## MODIFIED Requirements

### Requirement: Lead identity contacts and acquisition source
A lead SHALL have a required nonblank name and an optional contact (a person), organization, service, source, plain-text notes, deal amount and tags. Name SHALL be limited to 200 characters, service and source to 200, and notes to 10000. The contact and the organization SHALL belong to the client of the lead's board; a request naming a record of another client SHALL be refused with 400. The lead SHALL NOT hold its own company, phone, email, website, Telegram or messenger; a request naming one of them SHALL be refused with 400. A lead request MAY carry contact values (phone, email, Telegram, messenger) and an organization website: they SHALL be applied to the linked contact or organization under that record's rules, and when the lead has none, a contact or organization named after the lead SHALL be created, linked and given the value in the same transaction. Empty optional strings SHALL normalize to absence. Source SHALL be manually entered text. A lead SHALL be either created by a member or imported from a Meta integration; creating a lead by hand SHALL NOT require any integration. Absent source text SHALL display the imported origin for an imported lead and Не указан otherwise. Several leads SHALL be allowed to share one contact or organization.

#### Scenario: Minimal lead
- **WHEN** a member creates a lead with only a name
- **THEN** it is saved with no contact, no organization, no source values, no amount and no tags

#### Scenario: Contact round trip
- **WHEN** a member links a lead to the contact Анна, sets Анна's phone through the lead, and reopens the lead
- **THEN** the lead shows Анна with that phone, and Анна's record holds the phone

#### Scenario: A phone on a lead without a contact
- **WHEN** a member enters a phone for the lead Леонид, which has no contact
- **THEN** a contact Леонид holding that phone is created and linked to the lead

#### Scenario: Invalid input
- **WHEN** a name is blank, a field exceeds its limit, a contact email or organization website is invalid, or a request names the old field `phone`
- **THEN** the API returns 400 and nothing changes

#### Scenario: Source of a hand-made lead left blank
- **WHEN** a member creates a lead without source text
- **THEN** its card shows Не указан as the source

### Requirement: Leads are created in a side panel

The header's Добавить лид and every board column's add control SHALL open a side panel. The panel SHALL ask for the lead's name and offer the editable deal, contact, organization, description and board custom fields. A column add control SHALL preselect that column as the stage. A member SHALL be able to choose existing contact and organization records, or enter contact values that the lead API applies to a new record. Submitting valid values SHALL create one lead and open its record panel. A failed save SHALL keep the draft and show the reason. Closing the creation panel SHALL create nothing.

#### Scenario: Adding from a column
- **WHEN** a member starts a lead in Целевой, enters its name and amount, and submits the side panel
- **THEN** the lead is created in Целевой with that amount and its record panel opens

### Requirement: Imported leads show where they came from
A lead that arrived through an integration SHALL offer, in its side panel, a Информация tab holding everything the integration delivered, read-only: the channel Meta and the ad account identifier; the form identifier; the campaign, ad set and ad names recorded at import; the moment the prospect submitted the form; and every kept form answer in form order, with a notice when answers were omitted. When the lead is linked to an ad the member can reach, the tab SHALL offer that ad's creative preview. A lead created by a member SHALL offer no such tab.

The board card SHALL NOT name the Meta campaign an imported lead came from.

The integration's data SHALL be visible to every member who can read the board and SHALL NOT be writable through the interface or the lead API; contacts, notes and stage of an imported lead SHALL remain editable under the existing permissions.

#### Scenario: Opening an imported lead
- **WHEN** a member opens a lead imported from Meta and chooses Информация
- **THEN** the tab shows the account, form, campaign, ad set, ad, submission time and answers without editing controls for them

#### Scenario: Viewing the creative
- **WHEN** a member opens the creative preview from an imported lead linked to an ad
- **THEN** the ad's creatives are shown as they are from the campaign drill-down

#### Scenario: Card source
- **WHEN** an imported lead from campaign "Весна" is shown on the board
- **THEN** its board card does not mention Весна or Meta

#### Scenario: Manual lead
- **WHEN** a member opens a lead they created by hand
- **THEN** no Информация tab is offered

#### Scenario: Editing an imported lead's contacts
- **WHEN** an authorized member corrects the phone of an imported lead
- **THEN** the phone changes and the recorded source and answers are unchanged
