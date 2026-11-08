## 1. Records and migration in the API

- [x] 1.1 Add `Company`, `Person`, `Lead.personId` and `Lead.companyId` to the Prisma schema, and write the `crm_companies_people` migration: tables, indexes, the generated `phone_digits` column, the data move with merging, and dropping the six lead columns
- [x] 1.2 Add `leads/domain/crm-record.ts` with the field rules, and `PrismaCrmRecordRepository` with `reachesClient`, list, read, create, update, delete with unlinking, related counts and related leads filtered by reach
- [x] 1.3 Add `crm-record-use-cases.ts` with the client lock, permissions, audit as `crm-person` and `crm-company`, and `crm.changed` for each project of the client. Mount the routes under `/clients/:clientId/companies` and `/people`, add the entity types to audit isolation, and document the routes in OpenAPI
- [x] 1.4 Tests: migration on sample rows (email and phone merging, clients kept apart, company by name and by host, links, columns gone); record CRUD, validation, organization of another client refused, guest 403, unreached client 404, deletion unlinking leads and people with counts, audit and its isolation, realtime per project

## 2. Leads on records in the API

- [x] 2.1 Change the lead repository and record to `personId`, `companyId`, `person` and `company`. Make the lead schemas strict without the old fields, with `personId`, `companyId`, `contact` and `organization`, applied in lead create and update under the board lock with records of the same client only
- [x] 2.2 Add `clientId` to the board list, track `contact` and `organization` in lead activity while still reading old snapshots, and update the OpenAPI lead component
- [x] 2.3 Make the Meta intake create or reuse a person by email, then phone, and an organization by name
- [x] 2.4 Tests: linking and refusing another client's records; contact values creating and updating the contact; old fields answering 400; activity entries; intake reuse by email and phone, a new person, an organization from the company answer; the rest of the leads suite updated to the new shape

## 3. Web data and the view engine

- [x] 3.1 Add `entities/crm-record` with the types, queries and mutations; change `Lead` to `person` and `company` with the inputs `personId`, `companyId`, `contact` and `organization`; invalidate record queries on `crm.changed`
- [x] 3.2 Generalize `features/lead-view-options` to `RecordSchema`, with `leadSchema` reading the linked records, plus `companySchema` and `personSchema` and scoped state keys
- [x] 3.3 Tests: the existing view rules on `leadSchema`, search and filters over contact values, and the company and person schemas

## 4. Leads on records in the web

- [x] 4.1 Read contact values on board cards from `person` and `company`, adding the Контакт card field and renaming Компания to Организация
- [x] 4.2 Rebuild the lead panel's Контакты group: Контакт and Организация pickers with creation by name and a link to open the record, and contact and website rows saved through `contact` and `organization`
- [x] 4.3 Tests: cards with linked values, picking and creating a contact and an organization, editing a phone on a lead with and without a contact, guests read-only

## 5. CRM menu, tables and record panels

- [x] 5.1 Move `InlineText` to `shared/ui`, and extract the docked side panel behavior into `shared/ui/SidePanel`
- [x] 5.2 Build `widgets/crm-nav` with the board picker, the sections and their counts, collapsing to a row on narrow screens, and add `CrmLayout` with the `/crm`, `/crm/companies` and `/crm/people` routes
- [x] 5.3 Build `widgets/record-table` with sticky header and first column, cell editors and row opening
- [x] 5.4 Build `widgets/record-panel` for organizations and people, with grouped fields, Удалить with counts, and related people and leads that open the lead on its board
- [x] 5.5 Build `CrmCompaniesPage` and `CrmPeoplePage` with the view bar, Добавить, the table and the panel under `record` in the address
- [x] 5.6 Add the Таблица layout for leads
- [x] 5.7 Add the Russian copy to `ru.ts`
- [x] 5.8 Web tests: menu sections, counts, context kept across sections, addresses; tables listing, editing a cell, Escape and invalid values, guests; filters and sort on people and organizations and settings per client; panels with related lists and reach filtering; going to a lead; Добавить; the lead table layout and its order

## 6. Docs

- [x] 6.1 Update the README's CRM section for organizations, people, the menu, tables and the new lead API, and add the dump-before-deploy step to the deployment notes

## 7. Creation panels and motion

- [x] 7.1 Open a lead creation side panel from the header and board columns, with the lead's editable fields, validation and stage selection
- [x] 7.2 Open organization and person creation side panels with all record fields, validation and organization selection, including creation from a lead's contact rows with linking back to the lead
- [x] 7.3 Animate the shared side panel on open and close with reduced-motion support; cover creation, cancellation, errors and panel transitions in web tests, and update the README

## 8. Overlay panels

- [x] 8.1 Position CRM side panels over the right side of the board or table with a shadow, without resizing the content, and verify the layout
