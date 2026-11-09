## ADDED Requirements

### Requirement: A new lead appears among the people

Every lead created from now on, by a member or by an integration, SHALL have a person. When the lead names a contact the member chose, or when the lead's contact values match a person of the client by the rules of the migration of existing leads, the lead SHALL point to that person. Otherwise the API SHALL create a person named after the lead, linked to the lead, in the same transaction as the lead, and the person SHALL appear in Люди of the lead's client at once, without a reload on an open page. Creating that person SHALL be audited like any other person. A person whose lead is later deleted SHALL stay.

#### Scenario: A lead with a name only
- **WHEN** a member creates the lead Анна without a phone, email or contact
- **THEN** a person named Анна is created for the client and listed in Люди

#### Scenario: A lead with a chosen contact
- **WHEN** a member creates a lead and picks the existing person Ирина as its contact
- **THEN** no new person is created and the lead points to Ирина

#### Scenario: An imported lead
- **WHEN** a lead arrives from Meta with a name and a phone
- **THEN** it points to a person of the client, new or matched by the phone, and that person is listed in Люди

#### Scenario: An open people page
- **WHEN** a member has Люди open and another member creates a lead
- **THEN** the new person appears without a reload
