## Why

Window Hub runs its Meta campaigns on a Marquiz quiz on its Tilda site. Meta counts each quiz
submission as a result through the pixel, but holds no name or phone for it, so the CRM receives
none of these leads: 21 results in the last week reached no one. Marquiz can post every
submission to a webhook address, so the CRM can take the leads from the quiz directly.

## What Changes

- A public endpoint receives a Marquiz webhook at an address that carries the project's website
  key, and creates a website lead from it: the name, phone and email from the quiz contacts, the
  quiz answers as question and answer pairs, the quiz name, the UTM tags and the page address.
- The same submission delivered twice creates one lead, so a retried webhook adds nothing.
- The lead is linked to a campaign by `utm_campaign` and appears on the board exactly as a lead
  from the site script does.
- The CRM integrations window gets a Marquiz tab beside the web integration and Bitrix24. It shows
  the webhook address with a copy button and a short instruction for the quiz editor, and creates
  the project's website key when there is none.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `website-lead-intake`: a Marquiz quiz can send leads to a project by webhook, and a Marquiz tab
  in the CRM integrations window shows the webhook address.

## Impact

- API: `POST /api/intake/marquiz/:key` in the website intake router, a Marquiz payload schema
  and its mapping to a website lead, OpenAPI.
- Web: a Marquiz tab in the CRM integrations window, a Marquiz panel in the website leads feature,
  Russian and English copy.
- No schema change and no new dependency. The webhook uses the existing website key, its
  per-key limit and the server-to-server rule the `Authorization` header already follows.
