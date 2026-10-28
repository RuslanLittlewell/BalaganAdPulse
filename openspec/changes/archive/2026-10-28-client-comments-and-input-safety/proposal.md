## Why

A client can already post comments through the API, but in the app every comment reads as
«Неизвестный автор» to them and they cannot edit or delete their own: the comment list relies on
the organization's member list, which customers may not read. The request also asks for a
review of how input could carry script or markup into the app.

## What Changes

- Comments carry their author's name from the API; the comment list uses it and recognizes
  the signed-in person's own comments from the session, so a client sees names and manages
  their own comments.
- The session carries the signed-in person's membership id.
- The API validates rich text — task descriptions, project documents, report conclusions and
  plans — against the parts the editors produce, refusing unknown parts, non-plain attributes,
  excessive nesting and links with unsafe schemes.
- Length limits on task titles and checklist items, client details, project names, document
  titles, person names, phones and Telegram handles.
- Protective response headers on every response.
- The ad preview links to its source only for `http`/`https` addresses.

## Capabilities

### New Capabilities
- `input-safety`: how typed text and rich text are accepted and shown, and the headers that
  limit what a page may do.

### Modified Capabilities
- `task-comments`: clients comment on any task they reach and see authors' names.

## Impact

- API: comment payload gains `authorName`; session gains `membershipId`; schemas for tasks,
  projects, clients, identity, project documents and reports tighten; a shared rich-text
  validator; a headers middleware.
- Web: the comment list; the ad preview link.
