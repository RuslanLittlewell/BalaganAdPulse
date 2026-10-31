## Context

Documents are TipTap JSON stored in `project_document.content`, up to a megabyte. The list
endpoint returns summaries without content. The notebook is a two-column grid with a
`min-h-[28rem]` inside the project page, which sits in a scrolling container of the full height.

## Goals / Non-Goals

**Goals:**
- A notebook as tall as the space left on the page.
- Previews readable at a glance without opening each document.

**Non-Goals:**
- Rendered thumbnails or images of the document.
- Previews while a document is open.

## Decisions

- **The excerpt is built on the server** from the stored JSON, so the list stays one request
  and the client never downloads full texts it does not show. The list now reads the content
  column to build it; a project holds few documents, and the 1 MB cap bounds each.
- **An iterative walk** collects text blocks in document order and stops once 280 characters are
  gathered, so a deeply nested or huge document cannot exhaust the stack or the time of a list.
- **Plain lines, one per block**, rendered with preserved line breaks; headings are not styled
  apart, since the thumbnail is small.
- **The excerpt is part of every summary**, including those returned after a save or creation,
  so the list's cache stays complete when the editor updates it.
- **Relative time via `Intl.RelativeTimeFormat("ru")`** with `numeric: "auto"`, in minutes,
  hours and days, then the date after a week.
- **`min-h-full` on the project page's column and `flex-1` on the notebook**: the column fills
  the scrolled area, the notebook takes what the tabs leave, and a long document still scrolls
  the page.

## Risks / Trade-offs

- [The list reads every document's JSON] → bounded by the content cap and the small number of
  documents per project; a stored excerpt column can follow if lists grow.
