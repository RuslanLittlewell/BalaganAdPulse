## Context

Imported Meta leads enter through `createLeadIntake.deliver`, which locks the board, claims an external id so repeats are ignored, shifts the new column and creates the lead with its person and company. Share links already hold a project-scoped secret with hashing, rotation and audit entries.

## Decisions

- One key per project, stored as a SHA-256 hash with a short visible prefix. The key is shown in full only when it is created or rotated. Its plain value is part of the script tag, so it is public by design: it can only create leads. The shown value is therefore also kept readable by members who may manage it, which means it is stored encrypted rather than only hashed.
- Allowed sites are a list of hostnames on the key. The endpoint compares the request's `Origin` to the list and answers CORS only for listed sites. A key with an empty list rejects every request. The server also accepts server-to-server calls without an `Origin` when the request carries the key in the `Authorization` header, so custom backends can post leads.
- Spam control: a per-key rate limit, a per-visitor limit by IP, a body size cap, and a hidden honeypot field that the script leaves empty. A filled honeypot returns success and stores nothing.
- Repeats are ignored through the existing claim table with the key `site:<projectId>:<externalId>`. The script sends a random id per form submission.
- UTM tags are read from the landing URL once per visitor and kept for 30 days in first-party storage, so a form on a later page still carries them. The latest tags win when the URL carries new ones.
- Campaign attribution tries the Meta campaign id, then a case and space insensitive name match within the project. No match leaves the campaign empty and keeps the tags.
- Website leads use a new `WEBSITE` origin and a `lead_web_source` row, mirroring `lead_meta_source`. Answers keep the form's other fields as question and answer pairs.
- The script is a static file served by the API with a short cache. It has no dependencies and works without the key panel.

## Risks

- A public key can be copied from a page. The origin list, limits and honeypot bound the damage, and rotating the key stops a leak.
- Form detection can pick up forms that are not leads. The script only sends forms with a phone or email input and skips forms marked `data-balagan="off"`.
