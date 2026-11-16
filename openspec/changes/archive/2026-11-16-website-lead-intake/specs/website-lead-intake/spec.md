## ADDED Requirements

### Requirement: A project has one website key

An administrator or manager who can manage a project SHALL be able to create, rotate and remove the project's website key and edit the list of sites allowed to use it. A project SHALL have at most one key. The key SHALL be visible to members who may manage it, together with a ready script tag. Rotating SHALL stop the previous key at once. Each change SHALL be recorded in the audit log. Members without the right SHALL NOT see the key.

#### Scenario: Creating the key
- **WHEN** a manager creates the key for a project without one
- **THEN** the project shows the key, the script tag and an empty list of allowed sites

#### Scenario: Rotating the key
- **WHEN** a manager rotates the key
- **THEN** leads sent with the old key are refused and the new key works

#### Scenario: A member without the right
- **WHEN** a member who may not manage the project opens it
- **THEN** no key or script tag is shown

### Requirement: The script collects UTM tags and sends form leads

The API SHALL serve a script that a site adds with one tag carrying the website key. The script SHALL read `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` and `utm_term` from the page address, keep them for 30 days for that visitor, and replace them when a later address carries new tags. When a form that contains a phone or email input is submitted, the script SHALL send the form's name, phone, email and other filled fields, the stored tags, the page address and the referrer to the intake endpoint without blocking the submission. Forms marked `data-balagan="off"` SHALL be ignored. A function on the page SHALL let the site send a lead from its own code.

#### Scenario: A visitor arrives with tags and submits later
- **WHEN** a visitor opens a page with `utm_campaign=spring`, moves to another page and submits a contact form
- **THEN** the lead carries `utm_campaign=spring`

#### Scenario: A form without contact fields
- **WHEN** a form has no phone or email input
- **THEN** the script sends nothing

#### Scenario: Excluded form
- **WHEN** a form is marked `data-balagan="off"`
- **THEN** the script sends nothing

### Requirement: The intake endpoint creates leads for a valid key

A public endpoint SHALL accept a lead with the website key. It SHALL create the lead in the project's first column with the website origin, link or create the contact person and company like other imported leads, and announce the board change. A request with an unknown or rotated key, or from a site that is not on the key's list, SHALL be refused without creating a lead. A request carrying the key in an `Authorization` header and no `Origin` SHALL be accepted. A lead without a name SHALL use the phone, email or a default name. The same submission id sent twice SHALL create one lead. A filled honeypot field SHALL answer success and create nothing. Requests above the per-key and per-visitor limits, or above the body size cap, SHALL be refused. Responses SHALL NOT reveal whether a project exists.

#### Scenario: A lead from an allowed site
- **WHEN** a site on the list posts a lead with the key
- **THEN** the lead appears in the project's first column with the website origin

#### Scenario: A site that is not allowed
- **WHEN** a request with a valid key comes from a site that is not on the list
- **THEN** no lead is created and the response gives no CORS permission

#### Scenario: A repeated submission
- **WHEN** the same submission id arrives twice
- **THEN** one lead exists

#### Scenario: A bot fills the honeypot
- **WHEN** the honeypot field is filled
- **THEN** the response is successful and no lead is created

#### Scenario: Too many requests
- **WHEN** a key exceeds its limit
- **THEN** further requests are refused until the window passes

### Requirement: Leads are linked to a campaign by utm_campaign

When a website lead carries `utm_campaign`, the lead SHALL be linked to the project's campaign whose Meta id equals the value, otherwise to the single campaign whose name equals the value ignoring case and surrounding spaces. When no campaign matches, or several names match, the lead SHALL have no campaign and keep the tag. A member SHALL still be able to choose a campaign by hand.

#### Scenario: Matching by id
- **WHEN** `utm_campaign` equals a campaign's Meta id
- **THEN** the lead is linked to that campaign

#### Scenario: Matching by name
- **WHEN** `utm_campaign` equals a campaign name in other letter case
- **THEN** the lead is linked to that campaign

#### Scenario: No match
- **WHEN** no campaign matches
- **THEN** the lead has no campaign and its card shows the tag
