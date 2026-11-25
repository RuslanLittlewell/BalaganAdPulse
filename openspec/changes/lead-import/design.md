## Context

Leads reach a board three ways today: by hand, from the Meta lead poll, and from the website
intake (the site script and the Marquiz webhook). The two automatic paths share
`createLeadIntake`: an advisory lock per board, a claim in `meta_lead` that makes a repeated
delivery a no-op, the first column, and a contact of the client found by email or phone digits
or created. A website lead keeps its UTM tags, page, referrer, answers and submission date in
`lead_web_source`, and the board's arrival filter reads that date. A partner membership is tied
to one campaign, and a partner sees the leads whose `campaign_id` is that campaign.

The Gealan sheet that prompted this change mixes two sources. Its 91 lead form rows carry the Meta
ad ID as `ag:<id>` in `utm_id` and the Meta lead ID as `l:<id>` in `utm_term`; 72 of them are
already on the board from the Meta poll. Its 19 quiz rows carry the campaign ID in `utm_id` and the
ad set ID in `utm_term`. The campaign was renamed several times, so `utm_medium`, which holds its
name, carries four different names for one campaign. Answers from lead forms come as Meta's option
keys (`for_replacement`), answers from the quiz as the option text.

## Goals / Non-Goals

**Goals:**

- Bring a spreadsheet of leads onto one project's board in one pass, with campaigns linked.
- Never duplicate a lead the board already holds, whichever path created it.

**Non-Goals:**

- Excel files. Excel and Google Sheets both save CSV.
- Assignees, tags and custom fields.
- Updating leads that already exist, and undoing an import.
- Importing companies or contacts without leads.
- Rewriting Meta option keys into readable text.

## Decisions

- **Three stateless requests, mapping in the browser.** `POST …/imports/table` turns a file's text
  or a sheet link into `{ columns, rows }`. The browser proposes and edits the column roles and
  sends mapped rows (`name`, `phone`, `email`, `submittedAt`, `campaign`, UTM tags, `pageUrl`,
  `referrer`, `answers`) to `…/imports/preview`, which answers the counts and the campaign values,
  and then to `…/imports` with the member's campaign choices. Preview and import run the same
  planning code, so the preview cannot promise what the import will not do. An upload stored
  under an import session was considered and rejected: it needs storage, expiry and cleanup for a
  table the browser already holds.
- **One CSV parser on the server.** Files and sheets go through the same RFC 4180 parser, which
  detects the separator (comma, semicolon or tab) from the header row outside quotes and drops a
  byte order mark. The browser reads a file as bytes and decodes it as UTF-8, falling back to
  Windows-1251 when the bytes are not valid UTF-8, since Russian Excel saves CSV in that encoding.
- **A sheet link is never fetched as given.** The server accepts only `docs.google.com/spreadsheets/d/<id>`,
  takes `gid` from the query or the hash, and fetches the export address it builds itself:
  `https://docs.google.com/spreadsheets/d/<id>/export?format=csv&gid=<gid>`. It follows Google's
  redirect, stops after 15 seconds or 10 MB, and treats an HTML answer or a 401, 403 or 404 as a
  sheet closed to link access. No address chosen by the member reaches the network.
- **Column roles from names.** The browser lowercases each column name and matches it against
  lists of names per role (`name`, `имя`, `фио`; `phone`, `телефон`; `dt_created`, `created_time`,
  `date`, `дата`; `campaign_id`, `utm_id`, `campaign`, `кампания`; and so on) and a list of technical
  names to skip (`_fbc`, `_fbp`, `fbclid`, `gclid`, `yclid`, `useragent`, `ip`, `fingerprint`,
  `consent_*` and the like). The first column that matches a role takes it. Any other column is an
  answer whose question is the column name. `utm_id` is a campaign column because Meta's
  `{{campaign.id}}` parameter is conventionally put there.
- **Campaign lookup by IDs inside the value, then by name.** The planner takes every run of six or
  more digits in the campaign value and looks them up among the project's campaigns, ad sets and
  ads by `external_id`, in one query per kind for the whole table. A campaign match wins over an ad
  set or an ad; an ad also sets `ad_id`, which feeds the per-ad lead counts. A value with no ID
  match is compared with the campaign names, and only a single match links. The preview returns
  each distinct value with its row count and its campaign, and the import accepts
  `choices: [{ value, campaignId | null }]` that override the lookup for those values; a chosen
  campaign outside the project is refused. Matching by the ID inside the value covers the
  `ag:` prefix and any similar one without knowing the tool that wrote it.
- **A status picks the column.** A column with the status role places each lead in a board column.
  The planner builds one lookup of names: the board's own columns by name first, then each fixed
  stage by its key and its Russian and English names, including the longer titles the board
  shows («Квал. лид», «Qualified lead»). A status matches after trimming and lowercasing. The
  preview lists every status with the column found, and the dialog shows a column picker for each
  one, set to that column or to the first column. The import accepts
  `placements: [{ value, columnId }]` for the statuses the member changed, which override the
  lookup, where `columnId` is a
  stage key or the ID of a board column; a column outside the board is refused. A row with no
  status, or with an unmatched status left unpicked, goes to the first column, as intake leads do.
  The write shifts each target column down by the number of new leads it receives, so imported
  leads sit on top of every column, newest first.
- **Duplicates by contact, repeats by content.** The planner loads, in one query, the email and
  phone digits of the contacts of the board's leads, and skips a row that shares either; it then
  skips a row that shares either with an earlier row of the table. Each added lead also claims
  `import:<projectId>:<sha256 of its normalized row>` in `meta_lead`, so a row with a name only is
  not added twice either. The Meta lead ID in the Gealan sheet is not used: no general rule tells
  it apart from other IDs in a UTM tag, and the contact check already finds those 72 leads.
- **A new origin, the existing source table.** `lead_origin` gains `IMPORT`. The lead's details go to
  `lead_web_source`, which already holds every field a table row maps to and already drives the
  arrival filter, and the card shows them with the website source section under its own title.
  The lead's `created_at` is set to the submission date as well, because the web board dates a
  lead by its Meta submission date or its creation date. A separate import source table was
  considered and rejected: it would repeat `lead_web_source` column for column.
- **One transaction, written in batches.** The import takes the board's advisory lock, shifts each
  target column down by the number of new leads it receives, then writes the claims, the new contacts, the leads
  and their sources with one statement each. Contacts are matched against the client's contacts
  loaded once. It announces `crm.changed` for the leads, records and counts, and appends one audit
  entry on the project with the number of leads added.
- **Who may import.** The access policy gains the resource `lead-import`, created by `ADMIN` and
  `CLIENT_ADMIN`. The board must also be reachable, which limits a client admin to their own
  client's projects. The web shows the import button through the same policy.
- **Body size.** The three routes get their own JSON parser with a 12 MB limit, mounted before the
  global one, as the project documents routes do. A table is capped at 5000 rows.

## Risks / Trade-offs

- [Two different people share a phone or an email] → The second one is skipped as a duplicate. The
  preview shows the count of rows skipped as already on the board, so the member can add such a
  lead by hand.
- [An ID inside a value belongs to another project's campaign] → Lookups are limited to the board's
  project, so such a value matches nothing and is listed for a manual choice.
- [A name shared by several campaigns] → Only a single name match links; otherwise the value is
  listed for a manual choice.
- [5000 rows in one transaction hold the board's lock for a few seconds] → Writes are batched, and
  intake requests to the same board wait on the lock rather than fail.
- [A date column in an unknown format] → The planner reads ISO 8601 and `DD.MM.YYYY[ HH:MM[:SS]]`;
  any other value makes the lead arrive at the import time, and the preview counts those rows.

## Migration Plan

1. A migration adds `IMPORT` to the `lead_origin` enum. Existing leads and their sources are not
   touched and survive.
2. Deploy the API and the web together.
3. Rollback: before running an older build, set `origin = 'WEBSITE'` on leads with `origin = 'IMPORT'`,
   since an older Prisma client cannot read the new value. The unused enum value can stay.
