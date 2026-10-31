## Why

The notebook stops at a fixed minimum height, so on a tall screen its list and its divider end
halfway down the page. With no document open it shows a line of text, although the member is
there to pick a document, which is easier from previews of the documents than from titles.

## What Changes

- The notebook fills the height left on the page.
- With no document open, the notebook shows a preview card per document: a thumbnail of its
  first page — title, date and author of the last change, the beginning of its text — above its
  title and how long ago it was changed. Choosing a card opens the document.
- An open document has a back arrow to the previews, as does a document not found.
- The document list from the API carries an excerpt of each document's text, so previews need
  no extra request.

## Capabilities

### New Capabilities

### Modified Capabilities
- `project-documents`: the notebook's height and the previews shown while no document is open.

## Impact

- `apps/api/src/modules/project-documents`: an excerpt of the text in every document summary;
  the list reads the content to build it. OpenAPI says so.
- `apps/web/src/widgets/project-documents`: height, preview cards, time since the last change.
- `apps/web/src/pages/project`: the page fills the scrolled area so the notebook can grow.
