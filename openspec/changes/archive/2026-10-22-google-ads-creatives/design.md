## Context

An ad's creatives are read on first preview, their files copied into storage, and later views
served from the copy. The reading is Meta-only: the use case returns what is stored for any
other provider. Google's API describes an ad through its type and, for several types, through
assets that must be looked up by resource name.

## Decisions

- **A second reader beside Meta's, chosen by the connection's provider.** The use case keeps
  its flow, read once, copy the files, store, and asks the Google reader for connections of
  Google Ads. It uses the connection's refresh token and its manager account, as the import does.
- **Two queries per ad.** One reads the ad's type-specific fields, the other resolves the asset
  resource names it found into image addresses, YouTube video ids and titles. Lookups are
  capped, so an ad with many assets cannot make a preview expensive.
- **What each kind gives.** An image ad gives its image. Display and Demand Gen ads give their
  marketing and square images, in that order, and the YouTube videos they hold. Video ads give
  their YouTube videos. Search and text ads give text. An ad with text and media gives both,
  with the text creative last.
- **YouTube videos are not copied.** A video creative holds the video's id as its provider
  identifier, its title, a stored copy of the YouTube thumbnail as its poster, and a link to
  watch it. The preview shows the poster and the link, so no video file of Google's is stored.
- **Text is a creative of its own.** A text creative keeps its headlines in the title and its
  descriptions in the body, one per line, and has no file.
- **No rendered preview for Google.** The preview dialog shows Meta's rendered preview only for
  a video without a stored file and without a watch link, which a Meta ad has; a Google ad shows
  what it has.
- **Not read:** Performance Max, whose assets belong to asset groups rather than ads, and ad
  types the reader does not know; such an ad reads back with no creative, as before.
