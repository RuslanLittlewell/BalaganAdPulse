## Why

In Twenty, the left menu holds Companies, People and Opportunities, and an opportunity points to a company and a person. Our CRM has leads only, and each lead keeps its own copies of a company name and contact details. The same customer who writes twice becomes two unrelated leads with two copies of a phone number, and nobody can see everything a company has bought. The user asked for organizations and people in a CRM menu, owned by the client so they are shared across that client's projects. This is the third CRM change after `crm-custom-fields` and `crm-twenty-board`. It also brings forward the table view from the roadmap, because Twenty lists companies and people as tables.

## What Changes

- **New records: Организации and Люди.** Each record belongs to one client and is shared by all of that client's project boards.
  - An organization has a name, a website, a phone and notes.
  - A person has a name, a phone, an email, Telegram, a messenger, an organization and notes.
  - Access follows the client: a member who reaches any board of the client can read its records. Writing follows the member's lead permissions.
- **BREAKING (API): lead contacts move into records.**
  - A lead points to at most one person (Контакт) and one organization.
  - The lead's `company`, `phone`, `email`, `website`, `telegram` and `messenger` leave the lead API. The lead returns `person` and `company` summaries instead, and accepts `personId`, `companyId` and contact values, which are applied to the linked person and organization.
- **Migration.** A migration creates the records from the existing leads:
  - one person per lead, merged within a client when email or phone match;
  - one organization per distinct company name within a client, which takes the lead's website.
  - The old lead columns are then dropped.
- **Meta imports.** Imported leads create a person, or reuse one with the same email or phone in that client, and an organization when the form names a company.
- **A CRM menu column.** The CRM pages get their own left column:
  - the board picker at the top, as context;
  - then Лиды, Организации and Люди with their counts.
  - Организации and Люди show the records of the selected board's client.
- **Tables.**
  - Организации and Люди are tables with search, Фильтр, Сортировка and Настройки (visible columns and their order).
  - Text and number cells are edited in place.
  - Clicking a row opens the record in the side panel.
- **Record panels.** A person's panel lists their leads. An organization's panel lists its people and leads. Leads from boards the member cannot reach are left out.
- **Lead table.** Leads gain a third layout, Таблица, next to Канбан and Календарь. Its columns are the chosen card fields.
- **Lead panel.** The lead panel's Контакты group picks or creates the contact and the organization, and edits the contact's phone, email, Telegram and messenger and the organization's website in place.
- **Look.** Our own design tokens throughout. Nothing is copied from Twenty's code.

## Capabilities

### New Capabilities
- `crm-records`: Organizations and people owned by a client: fields and their validation, access, creation, editing, deletion and its effect on leads, audit and realtime, and the migration from lead contacts.
- `crm-navigation`: The CRM menu column with the board picker and the Лиды, Организации and Люди sections, their addresses and counts.
- `crm-record-table`: Table layouts for leads, organizations and people: columns, editing in place, the view bar for organizations and people, and the panels of organizations and people with their related records.

### Modified Capabilities
- `lead-crm`: A lead's identity loses its contact fields and gains a contact and an organization.
- `lead-side-panel`: The Контакты group works through the linked contact and organization.
- `crm-board-view`:
  - Cards, search and filters read contact values from the linked records.
  - Настройки offers the Таблица layout.
- `lead-calendar`: The layouts now include Таблица.
- `meta-lead-import`: Form answers fill a contact and an organization instead of lead fields.

## Impact

- **Database:** new `crm_company` and `crm_person` tables, and `person_id` and `company_id` on `lead`. A data migration fills them, then drops six lead columns. It cannot be undone without a backup.
- **API:**
  - New module `crm-records` with routes under `/api/crm/clients/:clientId/companies` and `/people`.
  - The lead schemas and repository change, the Meta intake changes, and the board list gains `clientId`.
  - Audit isolation adds the new entity types, and the OpenAPI docs are updated.
- **Web:**
  - New `widgets/crm-nav`, `widgets/record-table` and `widgets/record-panel`.
  - `features/lead-view-options` is generalized so organizations and people share it.
  - The lead panel's contacts group is rebuilt, and pages `crm/companies` and `crm/people` are added.
  - `ru.ts` gains the new copy.
- **Operations:** take a database dump before deploying, because the migration rewrites lead contacts.
