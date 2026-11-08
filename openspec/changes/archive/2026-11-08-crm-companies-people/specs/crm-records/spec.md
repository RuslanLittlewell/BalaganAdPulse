## Purpose

Keep a client's organizations and people as records of their own, shared by all of the client's project boards, so a lead points to who it is about instead of carrying copies of contact details.

## ADDED Requirements

### Requirement: Organizations and people belong to a client

An organization and a person SHALL each belong to exactly one client and SHALL be shared by all of that client's project boards. Deleting a client SHALL delete its organizations and people. Their fields SHALL be:

| Record | Field | Rules |
| --- | --- | --- |
| Organization | Название | required, trimmed, nonblank, at most 200 characters |
| Organization | Сайт | an HTTP or HTTPS address of at most 2048 characters |
| Organization | Телефон | at most 50 characters |
| Organization | Заметки | at most 10000 characters |
| Person | Имя | required, trimmed, nonblank, at most 200 characters |
| Person | Телефон | at most 50 characters |
| Person | Email | a valid address of at most 254 characters |
| Person | Telegram, Мессенджер | at most 100 characters each |
| Person | Организация | an organization of the same client |
| Person | Заметки | at most 10000 characters |

Empty optional values SHALL mean absence. Records with equal names or contacts SHALL be allowed. A request breaking these rules, or naming an organization of another client, SHALL be refused with 400.

#### Scenario: A person of one client
- **WHEN** a member creates the person Анна on client Ромашка, which has the projects Сайт and Реклама
- **THEN** Анна can be chosen as the contact of leads on both boards and on no other client's board

#### Scenario: An organization of another client
- **WHEN** a request links a person to an organization of another client
- **THEN** the API responds 400 and the person is unchanged

### Requirement: Access follows the client

A member who reaches at least one board of a client SHALL be able to list and read that client's organizations and people. A member who may create, update or delete leads SHALL be able to create, update or delete those records in the same way. Guests SHALL read them without changing them. A request about a client the member does not reach SHALL be refused with 404.

#### Scenario: A guest
- **WHEN** a guest who reaches a board of Ромашка opens Люди
- **THEN** they see Ромашка's people and are offered no control that changes them, and a change request is refused with 403

#### Scenario: Another client
- **WHEN** a member requests the people of a client they do not reach
- **THEN** the API responds 404

### Requirement: Deleting a record unlinks it

Deleting an organization or a person SHALL require confirmation that states how many leads, and for an organization how many people, point to it. A confirmed deletion SHALL clear those links in the same transaction and leave the leads and people standing.

#### Scenario: Deleting a contact
- **WHEN** a member confirms deleting the person Анна, who is the contact of two leads
- **THEN** the confirmation said two leads, and afterwards both leads remain without a contact

### Requirement: Record changes are audited and synchronized

Creating, changing and deleting an organization or a person SHALL be audited with its actor, client and changes, committed with the change. A failed request SHALL record nothing. These events SHALL be hidden from members who do not reach the client. Open CRM screens of the client's boards SHALL refresh after a committed change, and the notification SHALL carry no names or contact values.

#### Scenario: Another member edits a contact
- **WHEN** a member changes Анна's phone while another member has a board of the same client open
- **THEN** the other member's cards show the new phone without a reload

### Requirement: Existing lead contacts move into records

One migration SHALL move every lead's contact details into records and drop them from the lead.
- **People.** Every lead SHALL get a person, named after the lead and holding the lead's phone, email, Telegram and messenger. Within one client, leads with the same email (compared without regard to case) SHALL share one person. Leads without an email but with the same phone digits SHALL share one person. A shared person SHALL take the values of the most recent of those leads.
- **Organizations.** Within one client, leads with the same company name (compared trimmed and without regard to case) SHALL share one organization. The organization SHALL take the most recent website among those leads. A lead with a website but no company SHALL get an organization named after the website's host.
- **Links.** Each lead SHALL point to its person and organization. A person SHALL point to the organization of its most recent lead.

No other lead value SHALL change, and the migration SHALL record no audit event.

#### Scenario: Two leads with one email
- **WHEN** two leads of Ромашка's boards hold anna@example.com and Anna@Example.com before the migration
- **THEN** both point to one person afterwards, and that person holds the newer lead's phone

#### Scenario: Different clients
- **WHEN** leads of two different clients hold the same email
- **THEN** each client gets its own person

#### Scenario: A website without a company
- **WHEN** a lead holds the website https://www.romashka.by/contacts and no company
- **THEN** it points to an organization named romashka.by with that website
