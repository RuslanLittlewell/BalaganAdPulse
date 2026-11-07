## Context

Leads live in the `leads` module. Each lead carries `company`, `phone`, `email`, `website`, `telegram` and `messenger` as its own columns. A lead belongs to a project board, and a project belongs to a client.

Every lead mutation runs under a per-board advisory lock (`board-mutation.ts`), publishes `crm.changed` with the board, and is audited with whole snapshots. `createLeadEventDelivery` sends `crm.changed` to connections whose actor reaches the board. `reachableProjects(actor)` decides reach: admins reach every project, others reach the projects their grants cover. The Meta intake (`lead-intake.ts`) writes leads straight through its own repository.

On the web, the CRM page renders the view bar, the board, calendar or panel, and `features/lead-view-options`. That feature holds a field catalogue built only for leads, filter and sort rules over leads, and a persisted state keyed by person and board.

## Goals / Non-Goals

**Goals:**
- Keep organizations and people inside the `leads` module, so a lead change that creates or edits its contact stays in one transaction.
- Move existing contacts in one SQL migration, with merging rules that are predictable and testable.
- Make the view bar and the table work over any record type, so leads, organizations and people share one implementation.

**Non-Goals:**
- Custom fields on organizations or people.
- Merging duplicate records by hand, or deduplicating records created after the migration (except the Meta intake's reuse).
- Bulk selection and bulk actions in tables.
- Saved named views. The browser keeps the state, as before.
- Tasks, notes or other Twenty sections in the CRM menu.

## Decisions

### Records stay in the `leads` module

Two models, `Company` (`crm_company`) and `Person` (`crm_person`), sit in `prisma/models/leads.prisma`.
- Each carries `org_id` and `client_id`, both cascading on delete.
- `Person.company_id` points to `crm_company` and is set to null when the company is deleted.
- `Lead` gains `person_id` and `company_id`, both set to null on delete.
- Indexes: `(client_id, name)` on both tables, `(client_id, lower(email))` and `(client_id, phone_digits)` on people.

`phone_digits` is a stored generated column holding the phone with everything but digits removed. The Meta intake looks people up by it.

The domain goes in `leads/domain/crm-record.ts`: field rules, limits and the website check reused from leads. The use cases go in `leads/application/crm-record-use-cases.ts`. The repository is `PrismaCrmRecordRepository`. The routes live in the existing leads router under `/clients/:clientId/companies` and `/clients/:clientId/people`, so they share the `/api/crm` mount and the tariff gate.

A separate `crm-records` module was considered. A lead update that creates a contact would then need either a cross-module transaction port or two requests. Keeping both in `leads` keeps that in one transaction and reuses the lock helper.

### Locks and access per client

Record mutations take an advisory lock on `orgId:client:<clientId>`. Lead mutations keep the board lock. A lead request that creates or changes its contact or organization writes that record inside the board's transaction.

Concurrent edits of the same person through a lead and through the people table are both single-row updates, so the last one wins with no structural damage.

`reachesClient(actor, clientId)` is true when a reachable project belongs to the client. Reading needs `can(actor, 'read', 'lead')`, and writing needs the matching lead action. A client the member does not reach answers 404.

Related leads in a panel are filtered with `reachableProjects`, so a member limited to some projects of a client never sees leads of the others. The records themselves are visible to anyone who reaches the client, as the user chose. A member limited to project A can therefore see a contact whose only lead sits on project B, but not that lead.

### Lead API shape

The lead response drops `company`, `phone`, `email`, `website`, `telegram` and `messenger`. It adds:
- `personId` and `person: { id, name, phone, email, telegram, messenger } | null`;
- `companyId` and `company: { id, name, website } | null`.

The create and update schemas are strict, so the old keys answer 400. They gain:
- `personId` and `companyId`, which must belong to the board's client;
- `contact: { phone?, email?, telegram?, messenger? }`;
- `organization: { website? }`.

`contact` and `organization` are applied to the linked record. When the lead has no linked record, they create one named after the lead and link it.

The lead panel's Контакт and Организация pickers create a new record with `POST /clients/:clientId/people` or `/companies`, then link it with `PATCH lead { personId }`. Two requests are acceptable there: a failure leaves an unlinked record that is still visible in the table.

### Lead activity and audit

Lead snapshots now carry `personId`, `companyId` and the summaries. `buildActivity` adds two tracked fields, `contact` (from `person.name`) and `organization` (from `company.name`). It keeps reading the old fields in snapshots written before the migration, so history stays readable.

Record events are audited as `crm-person` and `crm-company` with `clientId`. Audit isolation adds both to `CRM_ENTITY_TYPES`.

### Realtime for records

A record change publishes `crm.changed` once for each project of the client. Delivery already checks board reach, and a client has few projects. On `crm.changed`, `useCrmEvents` also invalidates the record queries of the board's client, which are keyed by client id.

### Migration in SQL

One migration file does the work in order:
1. Create the tables and the new lead columns.
2. Build a temporary mapping of leads with their client id, contact key and company key:
   - contact key: `e:` plus the lowercased email, else `p:` plus the phone digits, else `l:` plus the lead id;
   - company key: the lowercased trimmed company name, else the website's host, else none.
3. Insert one company per `(client_id, company key)`. Its name and website come from the most recent lead in the group, by `DISTINCT ON` ordered by `created_at` descending.
4. Insert one person per `(client_id, contact key)`, taking the most recent lead's name, phone, email, Telegram, messenger and company.
5. Update every lead's `person_id` and `company_id` from the mapping.
6. Drop the six lead columns.

Ids come from `gen_random_uuid()`, which PostgreSQL 16 provides. The file is tested the same way the earlier migrations are tested: run in a scratch schema with sample rows.

### Meta intake reuses people

`PrismaLeadIntakeRepository.deliver` resolves the client from the project. It looks up a person by `lower(email)`, then by `phone_digits`, creates one if neither matches, and resolves or creates the company by lowercased name. All of this happens inside the intake's transaction, under the board lock it already takes.

### One view engine for all records

`features/lead-view-options` becomes record-agnostic: `RecordSchema<T> = { fields: SchemaField<T>[]; searchable(record): string[] }`. A `SchemaField` carries:
- `ref`, `label`, `kind` and `options`;
- `value(record)`;
- `listable` and `sortable` flags.

`visibleRecords`, `compareBy`, `operatorsFor` and `pruneState` take a schema. Three schema builders exist:
- `leadSchema(fields, columns)`, where the contact fields read `person` and `company`;
- `companySchema(peopleCounts, leadCounts)`;
- `personSchema(companies)`.

The state store keeps its storage key. Its keys gain a scope: `<user>:<board>` for leads as before, `<user>:companies:<client>` and `<user>:people:<client>`. The existing tests move onto the lead schema.

### Web structure

- `entities/crm-record`: the `Company` and `Person` types, queries keyed `["crm", "records", clientId, kind]`, and mutations.
- `widgets/crm-nav`: the menu column. It holds the board picker moved out of the page, the section links and the counts. Below `md` it collapses into a row.
- `widgets/record-table`: a generic table of columns. Each column has a header, a cell renderer and an optional in-place editor. The editor reuses `InlineText`, which moves to `shared/ui` so widgets can share it. The header and the first column are sticky.
- `widgets/record-panel`: the organization and person panels, with grouped `InlineText` fields, the menu and the related lists. It reuses the docked-aside behavior of the lead panel, extracted into `shared/ui/SidePanel`.
- Creation uses that same side panel: the header and board columns open `CreateLeadPanel` with the column stage preselected; Добавить on the record pages opens `CreateRecordPanel` with all fields for that record type. A single create request submits each draft. The shared panel is absolutely positioned over the right side of the board or table so it does not change their size; it has a shadow. `AnimatePresence` keeps a closing panel mounted until its slide and fade exit finishes; `SidePanel` uses reduced-motion preference.
- `pages/crm`: a `CrmLayout` route element with the column and an `<Outlet>`. `CrmLeadsPage` is the current page without the board picker. `CrmCompaniesPage` and `CrmPeoplePage` are new. The routes `/crm`, `/crm/companies` and `/crm/people` sit under the existing CRM module guard.
- The lead table is `widgets/record-table` fed by `leadSchema` columns. Its rows sort by column order, then position, unless a sort is set.

## Risks / Trade-offs

- **[The migration rewrites contact data and drops columns.]** The deploy takes a dump first, the migration is tested on sample data, and the README says how to restore. People are merged only on an exact email or phone match, so different prospects are not merged by mistake. The cost is that some duplicates stay.
- **[A member limited to some projects sees contacts from the client's other projects.]** This is accepted per the user's choice that records belong to the client. Leads stay filtered, so no lead or stage leaks.
- **[Removing lead fields from the API breaks any external caller.]** Only our web app calls this API. The OpenAPI docs and the README describe the new shape.
- **[Generalizing the view engine touches tested code.]** The existing filter, sort and prune tests are kept and run against the lead schema before the new schemas are added.
- **[A record change publishes one event per project of the client.]** Clients have a handful of projects. If that grows, a client-scoped event can replace it.

## Migration Plan

1. Take a database dump on production, for example with `backup.sh`, right before deploying.
2. Deploy during a short maintenance window. The deploy script applies `crm_companies_people` before replacing the app.
   - Existing leads keep everything else.
   - Their contacts become people and organizations.
   - Audit history is untouched.
3. Rollback means restoring the dump, because the dropped columns cannot be rebuilt from the new tables without loss of the merge decisions. A code-only rollback is not possible after the migration runs.
