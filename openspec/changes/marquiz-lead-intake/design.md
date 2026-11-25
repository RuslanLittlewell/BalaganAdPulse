## Context

The website intake endpoint `POST /api/intake/leads` already turns a request into a website lead.
It identifies the project by the website key, takes it from the body or from an `Authorization`
header, and accepts a request without `Origin` as server-to-server delivery only when the key
came in that header. A website lead carries a submission id, and a repeated id creates nothing.

Marquiz sends a webhook as a `POST` with a JSON body to an address set in the quiz editor under
Integrations, Webhooks. Only the address can be set: no headers, no secret, no signature. The
body, as Marquiz documents it, holds `contacts` (`name`, `email`, `phone`), `answers` (a list of
`q` and `a`), `quiz` (`id`, `name`), `created`, `result`, and `extra` with `href`, `referrer` and
`utm` (`source`, `medium`, `campaign`, `content`, `term`). It carries no submission id. Marquiz
expects a 2xx answer.

## Goals / Non-Goals

**Goals:**

- Create a website lead from a Marquiz webhook with no setup beyond pasting one address.
- Reuse the intake rules (board placement, contact linking, campaign linking, deduplication,
  announcement) instead of a second path into the board.

**Non-Goals:**

- Other quiz builders, and a generic webhook mapper.
- Marquiz's result block (title, cost) and discount fields.
- Reading leads from the Marquiz API.

## Decisions

- **The key travels in the address.** The webhook is `POST /api/intake/marquiz/:key` with the
  project's existing website key. Marquiz cannot send a header, so the path is the only place for
  a credential. A separate webhook secret per project was considered and rejected: it would need
  storage, rotation and a second panel, while the website key already authorizes server-to-server
  delivery through the `Authorization` header and is already shown in the site's script tag.
  Anyone holding the key could post leads either way; the per-key limit caps that, and rotating
  the key stops it. The address appears in our nginx access log, which stays on our server.
- **Server-to-server, whatever the allowed sites.** The request comes from Marquiz's servers, so
  the endpoint ignores `Origin` and delivers it as server-to-server. An empty list of allowed
  sites, which blocks browser requests, does not block the webhook. Only the per-key limit
  applies; a per-visitor limit would count every quiz's submissions against Marquiz's few
  addresses.
- **A submission id from the content.** Marquiz sends none, so the id is `marquiz-` followed by a
  SHA-256 of the quiz id, `created`, the contacts and the answers. A retried delivery repeats the
  body and so the id, and the intake's existing claim makes it a no-op.
- **Lenient mapping, strict refusal of non-submissions.** Unknown fields are ignored. Contacts,
  questions and answers are trimmed and cut to the intake's lengths (name 200, phone 50, email
  200, question 200, answer 2000, at most 50 pairs) rather than refused, since refusing would lose
  the lead. An answer may be a string, a number or a list; a list keeps every option. Empty
  answers are dropped, and a trailing `*`, Marquiz's required mark, is removed from the question.
  The quiz name becomes the pair «Квиз», in Russian like the website lead's default name, since
  it is shown on the lead card as written. `extra.utm.campaign` is the campaign tag, with
  `extra.utm.name` as a fallback because some Marquiz integrations use that key. A body that is
  not JSON, or has neither contacts nor answers, is refused with 400.
- **A tab of its own.** Marquiz is set up in the quiz editor, not on the site, so it gets its own
  tab in the CRM integrations window beside the web integration and Bitrix24 rather than a section
  of the web integration. The tab shares the project's website key: it builds the address from the
  page origin and the key, as the web integration builds its script tag, says that replacing the
  key changes the address, and creates the key itself when the project has none.

## Risks / Trade-offs

- [The documented sample dates from 2018 and Marquiz may have changed the body] → The mapping
  ignores unknown fields and needs only `contacts` or `answers`. The rollout task sends a test
  submission from the Window Hub quiz and checks the lead before relying on it.
- [Marquiz's retry behaviour is undocumented] → Deduplication by content id makes any number of
  retries safe.
- [Two visitors could submit identical contacts and answers in the same millisecond] → They
  would merge into one lead; with `created` in milliseconds and personal contacts this is
  negligible.
- [The key in the address can leak from the quiz settings] → Rotating the key in the web integration tab stops
  it at once, as it does for the site script.
