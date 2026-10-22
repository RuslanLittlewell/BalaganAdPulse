## 1. Storage and kinds

- [x] 1.1 Add the text kind and a source link to creatives in the schema, a migration, the API types and the OpenAPI document.

## 2. Reading from Google

- [x] 2.1 Read an ad's type-specific fields and resolve its assets in the Google Ads provider, mapping each ad kind to creatives.
- [x] 2.2 Let the creative use case read from Google for Google connections, copying images and thumbnails and keeping text and links; wire it in.

## 3. Showing them

- [x] 3.1 Show text creatives, and YouTube videos with a thumbnail and a link, in the preview dialog; keep Meta's rendered preview for Meta only.

## 4. Verification

- [x] 4.1 Cover the Google reader per ad kind, the use case, the storage and the dialog.
- [x] 4.2 Run `npm test` and `npm run test:web` until green; `openspec validate google-ads-creatives --strict`.
