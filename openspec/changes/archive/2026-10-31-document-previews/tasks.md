## 1. API

- [x] 1.1 Build a plain-text excerpt from a document's content, iteratively, capped at 280 characters
- [x] 1.2 Return the excerpt in every document summary and describe it in OpenAPI

## 2. Web

- [x] 2.1 Let the notebook fill the height left on the project page
- [x] 2.2 Show a preview card per document while none is open, opening it when chosen
- [x] 2.3 Say how long ago each document changed, falling back to the date after a week
- [x] 2.4 Put a back arrow before an open document's title, and on a document not found

## 3. Tests

- [x] 3.1 Cover the excerpt: blocks as lines, the cap with an ellipsis, empty and malformed content, the list response
- [x] 3.2 Cover the cards, their order, opening one and the time since the change
- [x] 3.3 Cover going back from a document, with a pending change saved, and from one not found
