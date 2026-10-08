## MODIFIED Requirements

### Requirement: CRM uses the task board visual language
The CRM SHALL appear in navigation at `/crm`. It SHALL use the task board's column panels, card styling, spacing, scroll behavior, drag overlay and keyboard drag affordance. Each card SHALL show name, supplied company and contact details, and the lead's tags, and SHALL NOT show its acquisition source or campaign. A lead without tags SHALL show no tag row. Long values SHALL truncate on the card and be readable in the lead card. Empty contacts SHALL NOT produce blank rows on the board card. Notes SHALL be editable in the lead card as its description. Contact actions SHALL NOT initiate a drag or accidentally open the editor. The lead card's stage choice SHALL offer every fixed stage and custom column of the lead's board in board order.

#### Scenario: Opening a card
- **WHEN** a member clicks or keyboard-opens a lead card
- **THEN** the two-column lead card shows the lead's fields and stage, with editing controls only when permitted

#### Scenario: Narrow display
- **WHEN** the viewport cannot fit every column
- **THEN** columns scroll horizontally and each column's cards scroll vertically within the available board height

#### Scenario: Stage choice with custom columns
- **WHEN** a member opens a lead on a board with a custom column Встреча
- **THEN** the stage choice lists Новый, Квалифицированный, Целевой, КП and Встреча in that order

#### Scenario: Tags on the board card
- **WHEN** a lead carries the tags Срочно and VIP
- **THEN** its board card shows Срочно and VIP where the source used to be

### Requirement: Imported leads show where they came from
A lead that arrived through an integration SHALL offer, in the right column of its card, a Доп. информация tab holding everything the integration delivered, read-only: the channel Meta and the ad account identifier; the form identifier; the campaign, ad set and ad names recorded at import; the moment the prospect submitted the form; and every kept form answer in form order, with a notice when answers were omitted. When the lead is linked to an ad the member can reach, the tab SHALL offer that ad's creative preview. A lead created by a member SHALL offer no such tab.

The board card SHALL NOT name the Meta campaign an imported lead came from.

The integration's data SHALL be visible to every member who can read the board and SHALL NOT be writable through the interface or the lead API; contacts, notes and stage of an imported lead SHALL remain editable under the existing permissions.

#### Scenario: Opening an imported lead
- **WHEN** a member opens a lead imported from Meta and chooses Доп. информация
- **THEN** the tab shows the account, form, campaign, ad set, ad, submission time and answers without editing controls for them

#### Scenario: Viewing the creative
- **WHEN** a member opens the creative preview from an imported lead linked to an ad
- **THEN** the ad's creatives are shown as they are from the campaign drill-down

#### Scenario: Card source
- **WHEN** an imported lead from campaign "Весна" is shown on the board
- **THEN** its board card does not mention Весна or Meta

#### Scenario: Manual lead
- **WHEN** a member opens a lead they created by hand
- **THEN** no Доп. информация tab is offered

#### Scenario: Editing an imported lead's contacts
- **WHEN** an authorized member corrects the phone of an imported lead
- **THEN** the phone changes and the recorded source and answers are unchanged
