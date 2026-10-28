## Context

Review of the paths by which typed input reaches a reader:

- React renders every value as text; the codebase has no `dangerouslySetInnerHTML`,
  `innerHTML` or `document.write`.
- Rich text is rendered by TipTap from stored JSON. TipTap 2.27's Link extension blanks hrefs
  whose scheme is unsafe when rendering, but the API stores any JSON for descriptions,
  documents and reports, so the editors are the only check, and a malformed document can stop
  a task, document or report from opening.
- Telegram messages escape `&`, `<`, `>` around every value; mail escapes too.
- Contact links prefix `https://` unless the value already starts with `http(s)://`, so a
  `javascript:` value cannot become a link; phones keep digits only; emails are validated.
- Uploaded task images, covers and avatars are checked by their bytes; lead files are served
  as attachments with `nosniff`.
- SQL goes through Prisma's parameterized queries; the only raw statement is a tagged
  template.
- No response carries `nosniff`, frame protection or a referrer policy beyond the proxy's HSTS.

## Goals / Non-Goals

**Goals:**
- Clients see who wrote comments and manage their own.
- The API refuses rich text the editors could not have produced.
- Cheap, compatible browser-side protections on every response.

**Non-Goals:**
- A full `script-src` Content Security Policy. It would be the strongest XSS mitigation, but
  it needs to be verified in a browser against the built app (fonts, blob and data images,
  WebSocket) before it can be enforced; left as a follow-up.

## Decisions

### Author names on comments

The repository joins the author's membership to their user and returns `authorName`.
Customers already see agency members' names in notifications, so this discloses nothing new.
The web app identifies its own comments by the session's `membershipId` rather than by
finding itself in the member list.

### One rich-text validator in the shared kernel

A pure function walks the document and answers the first problem or none. Each field names
the node and mark types its editor makes. Attributes are allowed as plain values only —
ProseMirror ignores unknown attributes, and refusing them would lock members out of saving
tasks whose stored descriptions carry one. Links are refused when they contain whitespace or
control characters, which browsers drop from a scheme, and otherwise unless they have no
scheme or `http`, `https`, `mailto` or `tel`. Depth is capped at 100 so the walk cannot
exhaust the stack.

### Headers

A small middleware sets the headers on every response, ahead of the routes; the landing's own
stricter policy still applies on its host.

## Risks / Trade-offs

- [Stored rich text the validator would refuse] → Checked against the local database before
  shipping; such a document still reads, and is refused only when saved unchanged in shape.
- [New length limits refusing an existing long value on save] → Limits are generous.
