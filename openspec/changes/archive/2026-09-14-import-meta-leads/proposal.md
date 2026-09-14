## Why

Media buyers read lead volume as "Конверсии" and cost per lead as "CPA", although the figure is Meta's aggregate `lead` action, so the dashboard speaks a different language from the ad cabinet. The CRM already holds funnels for each client, yet every Meta Instant Form lead has to be retyped by hand, arrives late and loses where it came from. Speed to first contact decides whether a paid lead converts.

## What Changes

- Present the existing conversions figure as "Лиды" and its derived cost ratio as "CPL" in every performance table, summary and chart. The data, API fields and derivation are unchanged.
- Poll Meta Instant Form leads for every connected project roughly every ten minutes, using the saved integration token, and create each lead once on the CRM board of the project's client in the "Новый лид" stage.
- On a project's first lead poll, whether a new connection or one that existed before this release, fetch leads created in the previous seven days; afterwards fetch only newer leads.
- Record where each imported lead came from: the Meta integration (account), the lead form, the campaign, the ad set and the ad whose creatives can be previewed from the lead, plus the moment the prospect submitted the form and every form answer.
- Map standard form answers (name, phone, email, company) into the lead's contact fields; keep the remaining answers readable on the lead.
- Never create the same Meta lead twice, including after a member deletes the imported lead.
- Keep the Meta source of an imported lead read-only while its contacts, notes and stage stay editable.
- Show lead import status separately from the advertising import, so missing lead permissions do not mark the whole connection as failed or require a new token.
- No **BREAKING** API changes: lead responses gain fields, metric fields keep their names.

## Capabilities

### New Capabilities
- `meta-lead-import`: Polling cadence, initial seven-day window, deduplication, field mapping, attribution to the imported hierarchy, lead access status and behaviour on disconnect.

### Modified Capabilities
- `lead-crm`: Leads may originate from a Meta integration; imported leads carry a read-only source (integration, form, campaign, ad set, ad, submission time, answers), name their ad, and are announced to open boards without a member actor.
- `campaign-metrics`: The conversions figure and its cost ratio are presented as leads and CPL.

## Impact

- Prisma: additive lead source columns and ad link on `lead`, a Meta lead key ledger that survives lead deletion, and lead-poll scheduling and status columns on `project_integration`.
- Backend: Graph provider reads of live ads and `/{ad_id}/leads`; a lead poll job alongside the existing import worker with its own lease; lead creation through the leads module with board ordering and realtime notification; attribution linking after each advertising import; OpenAPI for new lead and integration fields.
- Frontend: renamed metric labels in `ru.ts`; source block, form answers and creative preview entry in the lead dialog; source label on lead cards; lead import status in the Meta integration panel.
- External: the integration token needs `leads_retrieval`, `pages_show_list`, `pages_read_engagement`, `pages_manage_ads` and `ads_management`, a person with advertiser access on the Page, and Leads Access Manager permission when the Page customises it. Apps serving pages outside their own business need Meta App Review.
- Personal data: phone, email and form answers are stored like manually entered CRM contacts and follow existing board reach.
